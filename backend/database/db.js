const { Pool } = require('pg');
require('dotenv').config();

// Database connection configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'thesis_price_comparison',
  user: process.env.DB_USER || 'thesis_user',
  password: process.env.DB_PASSWORD,
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // return an error after 2 seconds if connection could not be established
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Test query
    const result = await client.query('SELECT NOW()');
    console.log('📅 Database time:', result.rows[0].now);
    
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    return false;
  }
};

// Generic query function
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Query executed:', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('❌ Query error:', error.message);
    throw error;
  }
};

// Get a client from the pool for transactions
const getClient = async () => {
  return await pool.connect();
};

// Database helper functions
const dbHelpers = {
  // Store operations
  async createStore(name, country, websiteUrl) {
    const query_text = `
      INSERT INTO stores (name, country, website_url) 
      VALUES ($1, $2, $3) 
      RETURNING id
    `;
    const result = await query(query_text, [name, country, websiteUrl]);
    return result.rows[0].id;
  },

  async getStoreByName(name, country) {
    const query_text = `
      SELECT * FROM stores 
      WHERE name = $1 AND country = $2
    `;
    const result = await query(query_text, [name, country]);
    return result.rows[0];
  },

  // Category operations
  async createCategory(name, description) {
    const query_text = `
      INSERT INTO categories (name, description) 
      VALUES ($1, $2) 
      ON CONFLICT (name) DO NOTHING
      RETURNING id
    `;
    const result = await query(query_text, [name, description]);
    return result.rows[0]?.id;
  },

  async getCategoryByName(name) {
    const query_text = `SELECT * FROM categories WHERE name = $1`;
    const result = await query(query_text, [name]);
    return result.rows[0];
  },

  // Product operations
  async createProduct(name, categoryId, brand, description, unit) {
    const query_text = `
      INSERT INTO products (name, category_id, brand, description, unit) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING id
    `;
    const result = await query(query_text, [name, categoryId, brand, description, unit]);
    return result.rows[0].id;
  },

  async getProductByName(name) {
    const query_text = `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.name = $1
    `;
    const result = await query(query_text, [name]);
    return result.rows[0];
  },

  // Price operations
  async createPrice(productId, storeId, price, currency, originalPrice, availability, scrapingUrl, note) {
    const query_text = `
      INSERT INTO prices (product_id, store_id, price, currency, original_price, availability, scraping_url, note) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING id
    `;
    const result = await query(query_text, [productId, storeId, price, currency, originalPrice, availability, scrapingUrl, note]);
    return result.rows[0].id;
  },

  async getLatestPrices(limit = 100) {
    const query_text = `
      SELECT 
        p.name as product_name,
        c.name as category_name,
        s.name as store_name,
        s.country,
        pr.price,
        pr.currency,
        pr.original_price,
        pr.availability,
        pr.scraped_at,
        pr.note
      FROM prices pr
      JOIN products p ON pr.product_id = p.id
      JOIN stores s ON pr.store_id = s.id
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY pr.scraped_at DESC
      LIMIT $1
    `;
    const result = await query(query_text, [limit]);
    return result.rows;
  },

  // Scraping session operations
  async createScrapingSession(storeId, sessionType, searchQuery) {
    const query_text = `
      INSERT INTO scraping_sessions (store_id, session_type, search_query, status) 
      VALUES ($1, $2, $3, 'running') 
      RETURNING id
    `;
    const result = await query(query_text, [storeId, sessionType, searchQuery]);
    return result.rows[0].id;
  },

  async updateScrapingSession(sessionId, productsFound, status, errorMessage) {
    const query_text = `
      UPDATE scraping_sessions 
      SET products_found = $2, status = $3, completed_at = CURRENT_TIMESTAMP, error_message = $4
      WHERE id = $1
    `;
    await query(query_text, [sessionId, productsFound, status, errorMessage]);
  },

  // Analytics
  async getPriceStatistics() {
    const query_text = `
      SELECT 
        COUNT(*) as total_prices,
        AVG(price) as average_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        COUNT(DISTINCT product_id) as unique_products,
        COUNT(DISTINCT store_id) as unique_stores
      FROM prices
      WHERE scraped_at > CURRENT_DATE - INTERVAL '30 days'
    `;
    const result = await query(query_text);
    return result.rows[0];
  }
};

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  ...dbHelpers
};