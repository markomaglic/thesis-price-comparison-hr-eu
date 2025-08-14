// backend/services/databaseService.js - Fixed for multiple countries
const db = require('../database/db');

class DatabaseService {
  constructor() {
    this.storeIds = {};
  }

  async initialize() {
    try {
      // Ensure ALL country stores exist
      const countries = ['Hrvatska', 'Germany', 'Slovenia', 'Austria'];
      
      for (const country of countries) {
        let store = await db.getStoreByName('Lidl', country);
        if (!store) {
          console.log(`🏪 Creating store: Lidl ${country}`);
          const storeId = await db.createStore('Lidl', country, `https://www.lidl.${this.getCountryCode(country)}`);
          this.storeIds[country] = storeId;
        } else {
          this.storeIds[country] = store.id;
        }
      }
      
      console.log('✅ Database service initialized with stores:', this.storeIds);
    } catch (error) {
      console.error('❌ Database service initialization error:', error);
      throw error;
    }
  }

  getCountryCode(country) {
    const codes = {
      'Hrvatska': 'hr',
      'Germany': 'de', 
      'Slovenia': 'si',
      'Austria': 'at'
    };
    return codes[country] || 'com';
  }

  async saveScrapedProducts(products, sessionType = 'manual', searchQuery = null) {
    console.log(`💾 Saving ${products.length} products to database...`);
    
    // Group products by country to see what we're saving
    const countryBreakdown = products.reduce((acc, product) => {
      acc[product.country] = (acc[product.country] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📊 Products by country to save:', countryBreakdown);

    const client = await db.getClient();
    let sessionId = null;
    let savedCount = 0;

    try {
      await client.query('BEGIN');

      // Create scraping session (use first store for session tracking)
      const firstStoreId = Object.values(this.storeIds)[0];
      const sessionResult = await client.query(
        'INSERT INTO scraping_sessions (store_id, session_type, search_query, status) VALUES ($1, $2, $3, $4) RETURNING id',
        [firstStoreId, sessionType, searchQuery, 'running']
      );
      sessionId = sessionResult.rows[0].id;

      for (const product of products) {
        try {
          console.log(`💾 Saving: ${product.name} (${product.country})`);
          
          // Get store ID for this country
          const storeId = this.storeIds[product.country];
          if (!storeId) {
            console.error(`❌ No store found for country: ${product.country}`);
            continue;
          }

          // Ensure category exists
          let categoryId = null;
          if (product.category) {
            const categoryResult = await client.query(
              'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
              [product.category]
            );
            categoryId = categoryResult.rows[0].id;
          }

          // Check if product exists (by name AND country to allow same product in different countries)
          let productId;
          const existingProduct = await client.query(
            `SELECT p.id FROM products p 
             JOIN prices pr ON p.id = pr.product_id 
             JOIN stores s ON pr.store_id = s.id 
             WHERE p.name = $1 AND s.country = $2`,
            [product.name, product.country]
          );

          if (existingProduct.rows.length > 0) {
            productId = existingProduct.rows[0].id;
            console.log(`♻️ Product exists: ${product.name} in ${product.country}`);
          } else {
            // Create new product
            const productResult = await client.query(
              'INSERT INTO products (name, category_id, unit, brand) VALUES ($1, $2, $3, $4) RETURNING id',
              [product.name, categoryId, product.unit, product.brand]
            );
            productId = productResult.rows[0].id;
            console.log(`✨ New product: ${product.name} in ${product.country}`);
          }

          // Save price record for this country
          await client.query(
            `INSERT INTO prices 
             (product_id, store_id, price, currency, original_price, availability, note) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              productId,
              storeId,  // This is the key - use correct store for country!
              product.price,
              product.currency || 'EUR',
              product.originalPrice,
              product.availability !== false,
              product.note
            ]
          );

          savedCount++;
          console.log(`✅ Saved: ${product.name} in ${product.country} for €${product.price}`);
          
        } catch (productError) {
          console.error(`❌ Error saving product ${product.name} (${product.country}):`, productError.message);
        }
      }

      // Update scraping session
      await client.query(
        'UPDATE scraping_sessions SET products_found = $1, status = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $3',
        [savedCount, 'completed', sessionId]
      );

      await client.query('COMMIT');
      
      console.log(`✅ Successfully saved ${savedCount} products to database`);
      
      // Verify what was saved
      const verifyResult = await client.query(`
        SELECT s.country, COUNT(*) as count 
        FROM prices pr 
        JOIN stores s ON pr.store_id = s.id 
        GROUP BY s.country 
        ORDER BY count DESC
      `);
      
      console.log('📊 Verification - Products by country in database:');
      verifyResult.rows.forEach(row => {
        console.log(`   ${row.country}: ${row.count} products`);
      });
      
      return { savedCount, sessionId };

    } catch (error) {
      await client.query('ROLLBACK');
      
      // Update session with error
      if (sessionId) {
        try {
          await client.query(
            'UPDATE scraping_sessions SET status = $1, error_message = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $3',
            ['failed', error.message, sessionId]
          );
        } catch (updateError) {
          console.error('❌ Error updating session:', updateError);
        }
      }
      
      console.error('❌ Database transaction error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getStoredProducts(limit = 100) {
    try {
      const result = await db.query(`
        SELECT 
          p.name,
          c.name as category,
          s.name as store,
          s.country,
          pr.price,
          pr.currency,
          pr.original_price,
          pr.availability,
          pr.scraped_at,
          pr.note,
          p.unit,
          p.brand
        FROM prices pr
        JOIN products p ON pr.product_id = p.id
        JOIN stores s ON pr.store_id = s.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE s.name = 'Lidl'
        ORDER BY pr.scraped_at DESC
        LIMIT $1
      `, [limit]);

      const products = result.rows.map(row => ({
        name: row.name,
        category: row.category,
        brand: row.brand,
        store: row.store,
        country: row.country,
        price: parseFloat(row.price),
        currency: row.currency,
        originalPrice: row.original_price ? parseFloat(row.original_price) : null,
        availability: row.availability,
        scrapedAt: row.scraped_at,
        note: row.note,
        unit: row.unit
      }));

      // Log breakdown for debugging
      const countryBreakdown = products.reduce((acc, product) => {
        acc[product.country] = (acc[product.country] || 0) + 1;
        return acc;
      }, {});
      
      console.log('📊 Retrieved products by country:', countryBreakdown);
      
      return products;
    } catch (error) {
      console.error('❌ Error fetching stored products:', error);
      throw error;
    }
  }

  async getProductStatistics() {
    try {
      const stats = await db.getPriceStatistics();
      
      const categoryStats = await db.query(`
        SELECT 
          c.name as category,
          COUNT(*) as product_count,
          AVG(pr.price) as avg_price
        FROM prices pr
        JOIN products p ON pr.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN stores s ON pr.store_id = s.id
        WHERE s.name = 'Lidl'
          AND pr.scraped_at > CURRENT_DATE - INTERVAL '30 days'
        GROUP BY c.name
        ORDER BY product_count DESC
      `);

      const countryStats = await db.query(`
        SELECT 
          s.country,
          COUNT(*) as product_count,
          AVG(pr.price) as avg_price
        FROM prices pr
        JOIN stores s ON pr.store_id = s.id
        WHERE s.name = 'Lidl'
          AND pr.scraped_at > CURRENT_DATE - INTERVAL '30 days'
        GROUP BY s.country
        ORDER BY product_count DESC
      `);

      console.log('📊 Statistics by country:', countryStats.rows);

      return {
        overall: stats,
        byCategory: categoryStats.rows,
        byCountry: countryStats.rows
      };
    } catch (error) {
      console.error('❌ Error fetching statistics:', error);
      throw error;
    }
  }

  async getScrapingSessions(limit = 10) {
    try {
      const result = await db.query(`
        SELECT 
          ss.*,
          s.name as store_name,
          s.country
        FROM scraping_sessions ss
        JOIN stores s ON ss.store_id = s.id
        ORDER BY ss.started_at DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching scraping sessions:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseService();