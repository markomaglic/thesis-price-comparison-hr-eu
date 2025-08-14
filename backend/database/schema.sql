CREATE TABLE stores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(50) NOT NULL,
    website_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for product categories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for products
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    brand VARCHAR(100),
    description TEXT,
    unit VARCHAR(50), -- e.g., "kg", "L", "piece"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for price records
CREATE TABLE prices (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    store_id INTEGER REFERENCES stores(id),
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    original_price DECIMAL(10, 2), -- for sales/discounts
    availability BOOLEAN DEFAULT true,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scraping_url VARCHAR(500),
    note TEXT
);

-- Table for scraping sessions
CREATE TABLE scraping_sessions (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES stores(id),
    session_type VARCHAR(50), -- 'basic', 'everyday', 'search'
    search_query VARCHAR(255),
    products_found INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed', -- 'running', 'completed', 'failed'
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT
);

-- Indexes for better performance
CREATE INDEX idx_prices_product_id ON prices(product_id);
CREATE INDEX idx_prices_store_id ON prices(store_id);
CREATE INDEX idx_prices_scraped_at ON prices(scraped_at);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_name ON products(name);

-- Insert initial data
INSERT INTO stores (name, country, website_url) VALUES 
    ('Lidl', 'Hrvatska', 'https://www.lidl.hr'),
    ('Lidl', 'Slovenia', 'https://www.lidl.si'),
    ('Lidl', 'Germany', 'https://www.lidl.de'),
    ('Lidl', 'Austria', 'https://www.lidl.at');

INSERT INTO categories (name, description) VALUES 
    ('Pekarski proizvodi', 'Kruh, peciva, kolači'),
    ('Mliječni proizvodi', 'Mlijeko, sir, jogurt, maslac'),
    ('Voće i povrće', 'Svježe voće i povrće'),
    ('Meso i riba', 'Svježe i zamrznuto meso i riba'),
    ('Zamrznuta hrana', 'Smrznuti proizvodi'),
    ('Napitci', 'Sokovi, vode, alkoholna pića'),
    ('Konzervirani proizvodi', 'Konzerve, teglice'),
    ('Žitarice i testenina', 'Riža, tjestenina, žitarice'),
    ('Konditorski proizvodi', 'Slatkiši, čokolada'),
    ('Ostalo', 'Ostali proizvodi');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();