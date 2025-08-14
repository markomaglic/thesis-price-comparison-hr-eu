// backend/services/priceHistoryService.js - FIXED SQL queries
const db = require('../database/db');

class PriceHistoryService {
  constructor() {
    this.priceVariationFactors = {
      // Seasonal price variations (0.9 = 10% cheaper, 1.1 = 10% more expensive)
      seasonal: {
        1: 1.05,  // January - winter prices higher
        2: 1.03,  // February
        3: 1.00,  // March - baseline
        4: 0.98,  // April - spring
        5: 0.95,  // May - fresh produce season
        6: 0.93,  // June - summer abundance
        7: 0.92,  // July - peak season
        8: 0.94,  // August
        9: 0.97,  // September
        10: 1.02, // October - pre-winter
        11: 1.06, // November - holiday season
        12: 1.08  // December - holiday premium
      },
      
      // Economic factors over time
      inflation: {
        '2023': 0.95,  // Prices were lower in 2023
        '2024': 1.00,  // Baseline 2024
        '2025': 1.03   // Current prices with inflation
      },
      
      // Country-specific economic trends
      countryTrends: {
        'Hrvatska': {
          trend: 0.002,  // 0.2% monthly increase (joining EU economic alignment)
          volatility: 0.05
        },
        'Germany': {
          trend: -0.001, // -0.1% monthly (strong economy, stable prices)
          volatility: 0.03
        },
        'Slovenia': {
          trend: 0.001,  // 0.1% monthly increase
          volatility: 0.04
        },
        'Austria': {
          trend: 0.0005, // 0.05% monthly increase
          volatility: 0.035
        }
      }
    };
  }

  // Generate historical price data for existing products
  async generateHistoricalPrices(monthsBack = 12) {
    console.log(`📈 Generating ${monthsBack} months of historical price data...`);
    
    try {
      // Get current products
      const currentProducts = await db.query(`
        SELECT 
          p.id as product_id,
          p.name,
          s.id as store_id,
          s.country,
          pr.price as current_price,
          pr.currency
        FROM prices pr
        JOIN products p ON pr.product_id = p.id
        JOIN stores s ON pr.store_id = s.id
        ORDER BY pr.scraped_at DESC
      `);

      console.log(`📦 Found ${currentProducts.rows.length} current products`);

      const client = await db.getClient();
      let insertedCount = 0;

      try {
        await client.query('BEGIN');

        // Create historical entries for each product
        for (const product of currentProducts.rows) {
          for (let monthsAgo = monthsBack; monthsAgo >= 1; monthsAgo--) {
            const historicalDate = new Date();
            historicalDate.setMonth(historicalDate.getMonth() - monthsAgo);
            
            // Add some random days within the month
            historicalDate.setDate(Math.floor(Math.random() * 28) + 1);
            
            const historicalPrice = this.calculateHistoricalPrice(
              product.current_price, 
              product.country, 
              historicalDate
            );

            // Insert historical price
            await client.query(`
              INSERT INTO prices 
              (product_id, store_id, price, currency, scraped_at, note, availability)
              VALUES ($1, $2, $3, $4, $5, $6, true)
            `, [
              product.product_id,
              product.store_id,
              historicalPrice,
              product.currency,
              historicalDate.toISOString(),
              `Historical price simulation for ${historicalDate.toISOString().split('T')[0]}`
            ]);

            insertedCount++;
          }
        }

        await client.query('COMMIT');
        console.log(`✅ Generated ${insertedCount} historical price entries`);
        
        return {
          success: true,
          insertedCount: insertedCount,
          monthsBack: monthsBack,
          productsProcessed: currentProducts.rows.length
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('❌ Error generating historical prices:', error);
      throw error;
    }
  }

  // Calculate what price would have been at a historical date
  calculateHistoricalPrice(currentPrice, country, historicalDate) {
    const now = new Date();
    const monthsDiff = (now.getFullYear() - historicalDate.getFullYear()) * 12 + 
                      (now.getMonth() - historicalDate.getMonth());
    
    // Start with current price
    let price = parseFloat(currentPrice);
    
    // Apply seasonal variation
    const month = historicalDate.getMonth() + 1;
    const seasonalFactor = this.priceVariationFactors.seasonal[month];
    price *= seasonalFactor;
    
    // Apply yearly inflation adjustment
    const year = historicalDate.getFullYear().toString();
    const inflationFactor = this.priceVariationFactors.inflation[year] || 1.0;
    price *= inflationFactor;
    
    // Apply country-specific trend
    const countryData = this.priceVariationFactors.countryTrends[country];
    if (countryData) {
      // Apply monthly trend (compound)
      const trendFactor = Math.pow(1 + countryData.trend, monthsDiff);
      price *= (1 / trendFactor); // Reverse for historical
      
      // Add volatility (random fluctuation)
      const volatility = (Math.random() - 0.5) * 2 * countryData.volatility;
      price *= (1 + volatility);
    }
    
    // Ensure minimum price
    price = Math.max(0.29, price);
    
    return Number(price.toFixed(2));
  }

  // FIXED: Get price history for a specific product
  async getProductPriceHistory(productName, country = null, monthsBack = 12) {
    try {
      console.log(`🔍 Getting price history for "${productName}", country: ${country}, months: ${monthsBack}`);
      
      let query;
      let params;
      
      if (country && country.trim() !== '') {
        // Query with country filter
        query = `
          SELECT 
            p.name,
            s.country,
            pr.price,
            pr.currency,
            pr.scraped_at,
            DATE_TRUNC('month', pr.scraped_at) as price_month
          FROM prices pr
          JOIN products p ON pr.product_id = p.id
          JOIN stores s ON pr.store_id = s.id
          WHERE LOWER(p.name) LIKE LOWER($1)
            AND s.country = $2
            AND pr.scraped_at >= NOW() - INTERVAL '1 month' * $3
          ORDER BY pr.scraped_at ASC
        `;
        params = [`%${productName}%`, country, monthsBack];
      } else {
        // Query without country filter
        query = `
          SELECT 
            p.name,
            s.country,
            pr.price,
            pr.currency,
            pr.scraped_at,
            DATE_TRUNC('month', pr.scraped_at) as price_month
          FROM prices pr
          JOIN products p ON pr.product_id = p.id
          JOIN stores s ON pr.store_id = s.id
          WHERE LOWER(p.name) LIKE LOWER($1)
            AND pr.scraped_at >= NOW() - INTERVAL '1 month' * $2
          ORDER BY pr.scraped_at ASC
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
        date: row.scraped_at,
        month: row.price_month
      }));

    } catch (error) {
      console.error('❌ Error getting price history:', error);
      throw error;
    }
  }

  // FIXED: Get average prices by month for comparison charts
  async getPriceComparisonOverTime(monthsBack = 12) {
    try {
      console.log(`📊 Getting price comparison for ${monthsBack} months...`);
      
      const result = await db.query(`
        SELECT 
          s.country,
          DATE_TRUNC('month', pr.scraped_at) as price_month,
          AVG(pr.price) as avg_price,
          COUNT(*) as product_count,
          MIN(pr.price) as min_price,
          MAX(pr.price) as max_price
        FROM prices pr
        JOIN stores s ON pr.store_id = s.id
        WHERE pr.scraped_at >= NOW() - INTERVAL '1 month' * $1
        GROUP BY s.country, DATE_TRUNC('month', pr.scraped_at)
        ORDER BY price_month ASC, s.country
      `, [monthsBack]);

      console.log(`✅ Found ${result.rows.length} data points for comparison`);

      // Group by month for easier frontend consumption
      const monthlyData = {};
      
      result.rows.forEach(row => {
        const monthKey = row.price_month.toISOString().split('T')[0].substring(0, 7); // YYYY-MM
        
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

      const sortedData = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
      console.log(`📊 Processed into ${sortedData.length} monthly data points`);
      
      return sortedData;

    } catch (error) {
      console.error('❌ Error getting price comparison over time:', error);
      throw error;
    }
  }

  // FIXED: Get trending products (biggest price changes)
  async getTrendingProducts(monthsBack = 6) {
    try {
      console.log(`🔥 Getting trending products for ${monthsBack} months...`);
      
      const result = await db.query(`
        WITH price_trends AS (
          SELECT 
            p.name,
            s.country,
            FIRST_VALUE(pr.price) OVER (PARTITION BY p.id, s.id ORDER BY pr.scraped_at ASC) as first_price,
            FIRST_VALUE(pr.price) OVER (PARTITION BY p.id, s.id ORDER BY pr.scraped_at DESC) as latest_price,
            COUNT(*) OVER (PARTITION BY p.id, s.id) as price_points
          FROM prices pr
          JOIN products p ON pr.product_id = p.id
          JOIN stores s ON pr.store_id = s.id
          WHERE pr.scraped_at >= NOW() - INTERVAL '1 month' * $1
        )
        SELECT DISTINCT
          name,
          country,
          first_price,
          latest_price,
          ROUND(((latest_price - first_price) / first_price * 100)::numeric, 2) as price_change_percent,
          price_points
        FROM price_trends
        WHERE price_points >= 3
        ORDER BY ABS(price_change_percent) DESC
        LIMIT 20
      `, [monthsBack]);

      console.log(`✅ Found ${result.rows.length} trending products`);

      return result.rows.map(row => ({
        productName: row.name,
        country: row.country,
        firstPrice: parseFloat(row.first_price),
        latestPrice: parseFloat(row.latest_price),
        priceChangePercent: parseFloat(row.price_change_percent),
        pricePoints: parseInt(row.price_points),
        trend: row.price_change_percent > 0 ? 'increasing' : 'decreasing'
      }));

    } catch (error) {
      console.error('❌ Error getting trending products:', error);
      throw error;
    }
  }

  // Simulate future price update (for ongoing tracking)
  async simulatePriceUpdate() {
    console.log('📈 Simulating price update...');
    
    try {
      // Get latest prices for all products
      const latestPrices = await db.query(`
        SELECT DISTINCT ON (p.id, s.id)
          p.id as product_id,
          p.name,
          s.id as store_id,
          s.country,
          pr.price as current_price,
          pr.currency
        FROM prices pr
        JOIN products p ON pr.product_id = p.id
        JOIN stores s ON pr.store_id = s.id
        ORDER BY p.id, s.id, pr.scraped_at DESC
      `);

      const client = await db.getClient();
      let updatedCount = 0;

      try {
        await client.query('BEGIN');

        for (const product of latestPrices.rows) {
          // Simulate small price change (±2%)
          const changePercent = (Math.random() - 0.5) * 0.04; // ±2%
          const newPrice = Math.max(0.39, product.current_price * (1 + changePercent));

          await client.query(`
            INSERT INTO prices 
            (product_id, store_id, price, currency, scraped_at, note, availability)
            VALUES ($1, $2, $3, $4, NOW(), $5, true)
          `, [
            product.product_id,
            product.store_id,
            Number(newPrice.toFixed(2)),
            product.currency,
            'Simulated price update'
          ]);

          updatedCount++;
        }

        await client.query('COMMIT');
        console.log(`✅ Updated ${updatedCount} product prices`);
        
        return { success: true, updatedCount };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('❌ Error simulating price update:', error);
      throw error;
    }
  }
}

module.exports = new PriceHistoryService();