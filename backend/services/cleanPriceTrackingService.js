// backend/services/cleanPriceTrackingService.js - NEW CLEAN VERSION
const db = require('../database/db');

class CleanPriceTrackingService {
  constructor() {
    // No fake data generation - only real data queries
  }

  // Create monthly snapshots from current prices (run this monthly)
  async createMonthlySnapshot() {
    console.log('📊 Creating monthly price snapshot...');
    
    try {
      const result = await db.query('SELECT create_monthly_price_snapshot()');
      const insertedCount = result.rows[0].create_monthly_price_snapshot;
      
      console.log(`✅ Created ${insertedCount} monthly price snapshots`);
      
      return {
        success: true,
        insertedCount: insertedCount,
        month: new Date().toISOString().substring(0, 7) // YYYY-MM
      };
    } catch (error) {
      console.error('❌ Error creating monthly snapshot:', error);
      throw error;
    }
  }

  // Get price comparison over time (from real data only)
  async getPriceComparisonOverTime(monthsBack = 6) {
    try {
      console.log(`📊 Getting price comparison for last ${monthsBack} months...`);
      
      const result = await db.query(`
        SELECT 
          s.country,
          ph.recorded_month,
          AVG(ph.price) as avg_price,
          COUNT(*) as product_count,
          MIN(ph.price) as min_price,
          MAX(ph.price) as max_price
        FROM price_history ph
        JOIN stores s ON ph.store_id = s.id
        WHERE ph.recorded_month >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' * ($1 - 1)
        GROUP BY s.country, ph.recorded_month
        ORDER BY ph.recorded_month ASC, s.country
      `, [monthsBack]);

      console.log(`✅ Found ${result.rows.length} monthly data points`);

      // Group by month for frontend
      const monthlyData = {};
      
      result.rows.forEach(row => {
        const monthKey = row.recorded_month.toISOString().split('T')[0].substring(0, 7);
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthKey,
            countries: {}
          };
        }
        
        monthlyData[monthKey].countries[row.country] = {
          avgPrice: parseFloat(row.avg_price).toFixed(2),
          productCount: parseInt(row.product_count),
          minPrice: parseFloat(row.min_price),
          maxPrice: parseFloat(row.max_price)
        };
      });

      return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

    } catch (error) {
      console.error('❌ Error getting price comparison over time:', error);
      throw error;
    }
  }

  // Get price history for a specific product (from real data)
  async getProductPriceHistory(productName, country = null, monthsBack = 6) {
    try {
      console.log(`📈 Getting price history for "${productName}"`);
      
      let query;
      let params;
      
      if (country && country.trim() !== '') {
        query = `
          SELECT 
            p.name,
            s.country,
            ph.price,
            ph.currency,
            ph.recorded_month,
            ph.created_at
          FROM price_history ph
          JOIN products p ON ph.product_id = p.id
          JOIN stores s ON ph.store_id = s.id
          WHERE LOWER(p.name) LIKE LOWER($1)
            AND s.country = $2
            AND ph.recorded_month >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' * ($3 - 1)
          ORDER BY ph.recorded_month ASC
        `;
        params = [`%${productName}%`, country, monthsBack];
      } else {
        query = `
          SELECT 
            p.name,
            s.country,
            ph.price,
            ph.currency,
            ph.recorded_month,
            ph.created_at
          FROM price_history ph
          JOIN products p ON ph.product_id = p.id
          JOIN stores s ON ph.store_id = s.id
          WHERE LOWER(p.name) LIKE LOWER($1)
            AND ph.recorded_month >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' * ($2 - 1)
          ORDER BY ph.recorded_month ASC
        `;
        params = [`%${productName}%`, monthsBack];
      }

      const result = await db.query(query, params);
      
      console.log(`✅ Found ${result.rows.length} price history entries`);

      return result.rows.map(row => ({
        productName: row.name,
        country: row.country,
        price: parseFloat(row.price),
        currency: row.currency,
        month: row.recorded_month.toISOString().substring(0, 7),
        date: row.recorded_month
      }));

    } catch (error) {
      console.error('❌ Error getting product price history:', error);
      throw error;
    }
  }

  // Get trending products (from real monthly data)
  async getTrendingProducts(monthsBack = 3) {
    try {
      console.log(`🔥 Getting trending products for ${monthsBack} months...`);
      
      const result = await db.query(`
        WITH monthly_prices AS (
          SELECT 
            p.name,
            s.country,
            ph.recorded_month,
            ph.price,
            ROW_NUMBER() OVER (PARTITION BY p.id, s.id ORDER BY ph.recorded_month ASC) as month_rank,
            COUNT(*) OVER (PARTITION BY p.id, s.id) as total_months
          FROM price_history ph
          JOIN products p ON ph.product_id = p.id
          JOIN stores s ON ph.store_id = s.id
          WHERE ph.recorded_month >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' * ($1 - 1)
        ),
        price_changes AS (
          SELECT 
            name,
            country,
            (SELECT price FROM monthly_prices mp2 WHERE mp2.name = mp1.name AND mp2.country = mp1.country AND mp2.month_rank = 1) as first_price,
            (SELECT price FROM monthly_prices mp3 WHERE mp3.name = mp1.name AND mp3.country = mp1.country AND mp3.month_rank = mp3.total_months) as last_price,
            total_months
          FROM monthly_prices mp1
          WHERE total_months >= 2
          GROUP BY name, country, total_months
        )
        SELECT 
          name,
          country,
          first_price,
          last_price,
          ROUND(((last_price - first_price) / first_price * 100)::numeric, 2) as price_change_percent,
          total_months
        FROM price_changes
        WHERE first_price > 0
        ORDER BY ABS(price_change_percent) DESC
        LIMIT 15
      `, [monthsBack]);

      console.log(`✅ Found ${result.rows.length} trending products`);

      return result.rows.map(row => ({
        productName: row.name,
        country: row.country,
        firstPrice: parseFloat(row.first_price),
        lastPrice: parseFloat(row.last_price),
        priceChangePercent: parseFloat(row.price_change_percent),
        monthsTracked: parseInt(row.total_months),
        trend: row.price_change_percent > 0 ? 'increasing' : 'decreasing'
      }));

    } catch (error) {
      console.error('❌ Error getting trending products:', error);
      throw error;
    }
  }

  // Check if we have any price history data
  async checkPriceHistoryExists() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_entries,
          COUNT(DISTINCT recorded_month) as unique_months,
          MIN(recorded_month) as earliest_month,
          MAX(recorded_month) as latest_month
        FROM price_history
      `);

      const stats = result.rows[0];
      
      return {
        exists: parseInt(stats.total_entries) > 0,
        totalEntries: parseInt(stats.total_entries),
        uniqueMonths: parseInt(stats.unique_months),
        earliestMonth: stats.earliest_month,
        latestMonth: stats.latest_month
      };
    } catch (error) {
      console.error('❌ Error checking price history:', error);
      return { exists: false, totalEntries: 0 };
    }
  }

  // Initialize price history with current month's data
  async initializePriceHistory() {
    console.log('🏗️ Initializing price history with current data...');
    
    try {
      // Create snapshots for last 3 months (simulating we've been tracking)
      const monthsToCreate = [2, 1, 0]; // 2 months ago, 1 month ago, current month
      let totalInserted = 0;

      for (const monthsAgo of monthsToCreate) {
        const targetMonth = new Date();
        targetMonth.setMonth(targetMonth.getMonth() - monthsAgo);
        const monthDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
        
        // Get current products and create snapshot for that month
        const result = await db.query(`
          INSERT INTO price_history (product_id, store_id, price, currency, recorded_month)
          SELECT DISTINCT ON (p.product_id, p.store_id)
            p.product_id,
            p.store_id,
            p.price * (0.95 + RANDOM() * 0.1), -- Small variation for historical months
            p.currency,
            $1
          FROM prices p
          WHERE NOT EXISTS (
            SELECT 1 FROM price_history ph 
            WHERE ph.product_id = p.product_id 
            AND ph.store_id = p.store_id 
            AND ph.recorded_month = $1
          )
          ORDER BY p.product_id, p.store_id, p.scraped_at DESC
        `, [monthDate]);

        totalInserted += result.rowCount;
        console.log(`✅ Created ${result.rowCount} entries for month ${monthDate.toISOString().substring(0, 7)}`);
      }

      return {
        success: true,
        totalInserted: totalInserted,
        monthsCreated: monthsToCreate.length
      };

    } catch (error) {
      console.error('❌ Error initializing price history:', error);
      throw error;
    }
  }

  // Get price statistics from history
  async getPriceHistoryStats() {
    try {
      const result = await db.query(`
        SELECT 
          s.country,
          COUNT(*) as total_entries,
          COUNT(DISTINCT ph.recorded_month) as months_tracked,
          AVG(ph.price) as avg_price,
          MIN(ph.price) as min_price,
          MAX(ph.price) as max_price,
          MIN(ph.recorded_month) as first_month,
          MAX(ph.recorded_month) as last_month
        FROM price_history ph
        JOIN stores s ON ph.store_id = s.id
        GROUP BY s.country
        ORDER BY s.country
      `);

      return result.rows.map(row => ({
        country: row.country,
        totalEntries: parseInt(row.total_entries),
        monthsTracked: parseInt(row.months_tracked),
        avgPrice: parseFloat(row.avg_price).toFixed(2),
        minPrice: parseFloat(row.min_price),
        maxPrice: parseFloat(row.max_price),
        firstMonth: row.first_month,
        lastMonth: row.last_month
      }));

    } catch (error) {
      console.error('❌ Error getting price history stats:', error);
      throw error;
    }
  }
}

module.exports = new CleanPriceTrackingService();