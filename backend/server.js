// backend/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import Lidl scraper with error handling
let LidlScraper;

try {
  LidlScraper = require('./services/scrapers/lidl');
} catch (error) {
  console.log('⚠️ Lidl scraper nije dostupan');
  LidlScraper = null;
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize scraper
const lidlScraper = LidlScraper ? new LidlScraper() : null;

// In-memory storage for scraped data
let scrapedData = {
  lidl: [],
  everyday: [],
  lastUpdate: null,
  lastEverydayUpdate: null,
  isScrapingInProgress: false
};

// Mock products for testing/fallback
const mockProducts = [
  {
    id: 1,
    name: 'Lidl Plus kruh wholemeal 500g',
    category: 'Pekarski proizvodi',
    prices: [
      { store: 'Lidl', country: 'Hrvatska', price: 0.69, currency: 'EUR', date: '2025-06-10' }
    ]
  },
  {
    id: 2,
    name: 'Milbona mlijeko 3.5% 1L',
    category: 'Mliječni proizvodi',
    prices: [
      { store: 'Lidl', country: 'Hrvatska', price: 1.09, currency: 'EUR', date: '2025-06-10' }
    ]
  }
];

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Lidl Price Scraper API - Working Version',
    version: '2.0.0',
    scraperStatus: LidlScraper ? 'Available' : 'Not configured',
    currency: 'EUR (Croatia)',
    endpoints: [
      'GET /api/products - Svi proizvodi (mock + scraped)',
      'GET /api/products/scraped - Samo scraped proizvodi',
      'GET /api/scrape/lidl - Pokreni osnovni Lidl scraping',
      'GET /api/scrape/lidl/everyday - Pokreni everyday proizvodi scraping',
      'GET /api/scrape/search/:query - Pretraži specifične proizvode',
      'GET /api/scrape/test - Test Lidl scraper',
      'GET /api/scrape/status - Status scraping-a',
      'GET /health - Health check'
    ]
  });
});

// Get all products (mock + scraped)
app.get('/api/products', (req, res) => {
  const allProducts = [...mockProducts];
  
  // Add scraped data as new products (use everyday if available, otherwise regular)
  const dataToUse = scrapedData.everyday.length > 0 ? scrapedData.everyday : scrapedData.lidl;
  
  dataToUse.forEach((product, index) => {
    allProducts.push({
      id: mockProducts.length + index + 1,
      name: product.name,
      category: product.category,
      prices: [{
        store: product.store,
        country: product.country,
        price: product.price,
        currency: product.currency,
        date: product.scrapedAt?.split('T')[0] || new Date().toISOString().split('T')[0]
      }]
    });
  });

  res.json({
    success: true,
    data: allProducts,
    count: allProducts.length,
    scrapedCount: dataToUse.length,
    lastScrapingUpdate: scrapedData.lastEverydayUpdate || scrapedData.lastUpdate,
    dataSource: scrapedData.everyday.length > 0 ? 'everyday' : 'regular'
  });
});

// Get only scraped products
app.get('/api/products/scraped', (req, res) => {
  const dataToUse = scrapedData.everyday.length > 0 ? scrapedData.everyday : scrapedData.lidl;
  const lastUpdate = scrapedData.lastEverydayUpdate || scrapedData.lastUpdate;
  
  res.json({
    success: true,
    data: dataToUse,
    count: dataToUse.length,
    lastUpdate: lastUpdate,
    store: 'Lidl',
    dataSource: scrapedData.everyday.length > 0 ? 'everyday' : 'regular'
  });
});

// Basic Lidl scraping endpoint - searches for specific terms
app.get('/api/scrape/lidl', async (req, res) => {
  if (!lidlScraper) {
    return res.json({
      success: false,
      error: 'Lidl scraper nije konfiguriran',
      message: 'Provjeri da li postoji datoteka services/scrapers/lidl.js',
      store: 'Lidl'
    });
  }

  if (scrapedData.isScrapingInProgress) {
    return res.json({
      success: false,
      message: 'Scraping je već u tijeku, molimo pričekajte...',
      inProgress: true
    });
  }

  try {
    scrapedData.isScrapingInProgress = true;
    
    console.log('🚀 Pokretam osnovni Lidl scraping...');
    
    // Search for some basic products
    const searchTerms = ['sir', 'mlijeko', 'kruh'];
    let allProducts = [];
    
    for (let term of searchTerms) {
      console.log(`🔍 Searching for: ${term}`);
      const products = await lidlScraper.searchProducts(term, 3);
      allProducts = allProducts.concat(products);
      
      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Remove duplicates
    const uniqueProducts = allProducts.filter((product, index, self) => 
      index === self.findIndex(p => p.name.toLowerCase() === product.name.toLowerCase())
    );
    
    scrapedData.lidl = uniqueProducts;
    scrapedData.lastUpdate = new Date().toISOString();
    
    console.log(`✅ Basic scraping završen! Pronašao ${uniqueProducts.length} proizvoda`);
    
    res.json({
      success: true,
      message: `Uspješno dohvaćeno ${uniqueProducts.length} proizvoda s Lidla`,
      data: uniqueProducts,
      count: uniqueProducts.length,
      scrapedAt: scrapedData.lastUpdate,
      note: 'Basic Lidl scraping - few key products',
      searchTerms: searchTerms
    });
    
  } catch (error) {
    console.error('❌ Greška kod osnovnog scraping-a:', error);
    
    res.status(500).json({
      success: false,
      message: 'Greška kod osnovnog scraping-a Lidla',
      error: error.message
    });
  } finally {
    scrapedData.isScrapingInProgress = false;
  }
});

// Everyday products scraping endpoint - comprehensive search
app.get('/api/scrape/lidl/everyday', async (req, res) => {
  if (!lidlScraper) {
    return res.json({
      success: false,
      error: 'Lidl scraper nije konfiguriran'
    });
  }

  if (scrapedData.isScrapingInProgress) {
    return res.json({
      success: false,
      message: 'Scraping je već u tijeku...',
      inProgress: true
    });
  }

  try {
    scrapedData.isScrapingInProgress = true;
    
    console.log('🛒 Pokretam comprehensive everyday proizvodi scraping...');
    
    // Use the dedicated everyday products method
    const products = await lidlScraper.searchEverydayProducts(2);
    
    scrapedData.everyday = products;
    scrapedData.lastEverydayUpdate = new Date().toISOString();
    
    // Group by category for better overview
    const groupedByCategory = products.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = [];
      }
      acc[product.category].push(product);
      return acc;
    }, {});
    
    console.log(`✅ Everyday scraping završen! Pronašao ${products.length} proizvoda`);
    
    res.json({
      success: true,
      message: `Pronašao ${products.length} everyday proizvoda`,
      data: products,
      count: products.length,
      categories: Object.keys(groupedByCategory).length,
      groupedByCategory: groupedByCategory,
      scrapedAt: scrapedData.lastEverydayUpdate,
      note: 'Comprehensive everyday essentials scraping'
    });
    
  } catch (error) {
    console.error('❌ Greška scraping everyday products:', error);
    
    res.json({
      success: false,
      message: 'Greška kod everyday scraping-a',
      error: error.message,
      note: 'Everyday scraping failed'
    });
  } finally {
    scrapedData.isScrapingInProgress = false;
  }
});

// Search specific products endpoint
app.get('/api/scrape/search/:query', async (req, res) => {
  const { query } = req.params;
  const { limit = 10 } = req.query;
  
  if (!query || query.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Query mora imati najmanje 2 znakova'
    });
  }
  
  if (!lidlScraper) {
    return res.json({
      success: false,
      error: 'Lidl scraper nije konfiguriran'
    });
  }
  
  try {
    console.log(`🔍 Pretraživanje Lidl: "${query}"`);
    
    const products = await lidlScraper.searchProducts(query, parseInt(limit));
    
    res.json({
      success: true,
      query: query,
      data: products,
      count: products.length,
      scrapedAt: new Date().toISOString(),
      note: `Search results for "${query}"`
    });
    
  } catch (error) {
    console.error('❌ Greška kod pretrage:', error);
    res.status(500).json({
      success: false,
      message: 'Greška kod pretrage proizvoda',
      error: error.message
    });
  }
});

// Test scraper endpoint
app.get('/api/scrape/test', async (req, res) => {
  if (!lidlScraper) {
    return res.json({
      success: false,
      error: 'Lidl scraper nije konfiguriran'
    });
  }

  try {
    console.log('🧪 Testiram Lidl scraper...');
    
    const testResults = await lidlScraper.testScraping();
    
    res.json({
      success: testResults.success,
      message: 'Test scraper-a završen',
      data: testResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Greška kod testiranja scraper-a',
      error: error.message
    });
  }
});

// Check access to Lidl website
app.get('/api/scrape/check-access', async (req, res) => {
  if (!lidlScraper) {
    return res.json({
      success: false,
      error: 'Lidl scraper nije konfiguriran'
    });
  }

  try {
    console.log('🔍 Provjeravam pristup Lidl.hr...');
    
    const accessCheck = await lidlScraper.checkAccess();
    
    res.json({
      success: true,
      message: 'Provjera pristupa završena',
      data: accessCheck,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Greška kod provjere pristupa',
      error: error.message
    });
  }
});

// Scraping status
app.get('/api/scrape/status', (req, res) => {
  res.json({
    success: true,
    isScrapingInProgress: scrapedData.isScrapingInProgress,
    lastUpdate: scrapedData.lastUpdate,
    lastEverydayUpdate: scrapedData.lastEverydayUpdate,
    basicProductsCount: scrapedData.lidl.length,
    everydayProductsCount: scrapedData.everyday.length,
    store: 'Lidl',
    currency: 'EUR',
    scraperConfigured: lidlScraper !== null,
    nextUpdate: 'Manual'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    scrapingStatus: scrapedData.isScrapingInProgress ? 'IN_PROGRESS' : 'IDLE',
    basicProducts: scrapedData.lidl.length,
    everydayProducts: scrapedData.everyday.length,
    scraperAvailable: lidlScraper !== null,
    store: 'Lidl',
    currency: 'EUR'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Nešto je pošlo po zlu!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint nije pronađen'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server pokrenut na portu ${PORT}`);
  console.log(`📱 API dostupan na: http://localhost:${PORT}`);
  console.log(`🛒 Lidl scraper: ${LidlScraper ? '✅ Konfiguriran' : '❌ Nije dostupan'}`);
  console.log(`💰 Currency: EUR (Croatia)`);
  console.log(`🕷️  Lidl endpoints:`);
  console.log(`   GET http://localhost:${PORT}/api/scrape/lidl - Basic scraping`);
  console.log(`   GET http://localhost:${PORT}/api/scrape/lidl/everyday - Comprehensive everyday`);
  console.log(`   GET http://localhost:${PORT}/api/scrape/search/sir - Search specific product`);
  console.log(`   GET http://localhost:${PORT}/api/scrape/test - Test scraper`);
  console.log(`   GET http://localhost:${PORT}/api/scrape/check-access - Check website access`);
  console.log(`   GET http://localhost:${PORT}/api/scrape/status - Scraping status`);
  console.log(`📊 Status: http://localhost:${PORT}/health`);
});

module.exports = app;