// backend/scripts/setup-database.js
const fs = require('fs');
const path = require('path');
const db = require('../database/db');

async function setupDatabase() {
  console.log('🚀 Starting database setup...');

  try {
    // Test connection
    const connected = await db.testConnection();
    if (!connected) {
      throw new Error('Could not connect to database');
    }

    // Read and execute schema
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('📋 Executing database schema...');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Execute schema (split by ; and execute each statement)
      const statements = schema.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await db.query(statement);
          } catch (error) {
            // Ignore "already exists" errors
            if (!error.message.includes('already exists') && 
                !error.message.includes('duplicate key')) {
              console.warn('⚠️ Schema warning:', error.message);
            }
          }
        }
      }
      
      console.log('✅ Database schema applied successfully');
    } else {
      console.log('⚠️ Schema file not found, creating basic tables...');
      
      // Basic table creation if schema file doesn't exist
      await db.query(`
        CREATE TABLE IF NOT EXISTS stores (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          country VARCHAR(50) NOT NULL,
          website_url VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await db.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await db.query(`
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category_id INTEGER REFERENCES categories(id),
          unit VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await db.query(`
        CREATE TABLE IF NOT EXISTS prices (
          id SERIAL PRIMARY KEY,
          product_id INTEGER REFERENCES products(id),
          store_id INTEGER REFERENCES stores(id),
          price DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'EUR',
          availability BOOLEAN DEFAULT true,
          scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // Verify tables exist
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('📊 Database tables:');
    tables.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    // Get some basic stats
    const stats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM stores) as stores_count,
        (SELECT COUNT(*) FROM categories) as categories_count,
        (SELECT COUNT(*) FROM products) as products_count,
        (SELECT COUNT(*) FROM prices) as prices_count
    `);

    console.log('📈 Database statistics:');
    const counts = stats.rows[0];
    console.log(`  🏪 Stores: ${counts.stores_count}`);
    console.log(`  📂 Categories: ${counts.categories_count}`);
    console.log(`  📦 Products: ${counts.products_count}`);
    console.log(`  💰 Price records: ${counts.prices_count}`);

    console.log('\n✅ Database setup completed successfully!');
    console.log('\n🎯 Next steps:');
    console.log('  1. Start your backend: npm run backend:dev');
    console.log('  2. Test scraping: GET http://localhost:3001/api/scrape/lidl');
    console.log('  3. View data: GET http://localhost:3001/api/products/database');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('🏁 Setup script finished');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Setup script failed:', error);
      process.exit(1);
    });
}

module.exports = setupDatabase;