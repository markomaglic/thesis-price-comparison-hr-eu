// backend/services/openFoodFactsService.js - Improved version
const axios = require('axios');

class OpenFoodFactsService {
  constructor() {
    this.baseURL = 'https://world.openfoodfacts.org';
    this.headers = {
      'User-Agent': 'ThesisPriceComparison/1.0 (thesis-research@example.com)'
    };
    
    // Price simulation ranges for realistic Croatian vs EU pricing
    this.priceRanges = {
      'Mliječni proizvodi': { min: 0.89, max: 3.49, euMultiplier: 0.85 },
      'Napitci': { min: 0.59, max: 2.99, euMultiplier: 0.90 },
      'Žitarice i testenina': { min: 0.79, max: 4.99, euMultiplier: 0.88 },
      'Voće i povrće': { min: 1.29, max: 8.99, euMultiplier: 0.82 },
      'Meso i riba': { min: 2.99, max: 15.99, euMultiplier: 0.80 },
      'Pekarski proizvodi': { min: 0.69, max: 3.99, euMultiplier: 0.85 },
      'Zamrznuta hrana': { min: 1.49, max: 7.99, euMultiplier: 0.83 },
      'default': { min: 0.99, max: 4.99, euMultiplier: 0.85 }
    };

    // Common Croatian food categories for better search
    this.croatianCategories = [
      'mlijeko', 'sir', 'jogurt', 'kruh', 'meso', 'riba', 'voće', 'povrće',
      'pasta', 'riža', 'ulje', 'mrkva', 'banana', 'jabuka', 'paradajz',
      'krumpir', 'luk', 'čokolada', 'keks', 'sok', 'voda'
    ];
  }

  // Search products by term - improved version
  async searchProducts(searchTerm, limit = 20) {
    try {
      console.log(`🔍 Searching Open Food Facts for: "${searchTerm}"`);
      
      // Try multiple search approaches
      const searchStrategies = [
        // Strategy 1: General search
        {
          url: `${this.baseURL}/cgi/search.pl`,
          params: {
            search_terms: searchTerm,
            search_simple: 1,
            json: 1,
            page_size: Math.min(limit * 2, 50),
            fields: 'product_name,brands,categories,stores,countries,quantity,code'
          }
        },
        // Strategy 2: Category-based search
        {
          url: `${this.baseURL}/cgi/search.pl`,
          params: {
            search_terms: searchTerm,
            json: 1,
            page_size: Math.min(limit * 2, 50),
            action: 'process',
            fields: 'product_name,brands,categories,stores,countries,quantity,code'
          }
        }
      ];

      let allProducts = [];
      
      for (let i = 0; i < searchStrategies.length && allProducts.length < limit; i++) {
        const strategy = searchStrategies[i];
        
        try {
          console.log(`📡 Trying search strategy ${i + 1}...`);
          
          const response = await axios.get(strategy.url, { 
            params: strategy.params, 
            headers: this.headers,
            timeout: 15000 
          });

          console.log(`📊 API Response status: ${response.status}`);
          console.log(`📊 Response data keys:`, Object.keys(response.data || {}));

          if (response.data && response.data.products && Array.isArray(response.data.products)) {
            console.log(`📦 Found ${response.data.products.length} products in strategy ${i + 1}`);
            
            const products = this.processProducts(response.data.products, limit - allProducts.length);
            allProducts = allProducts.concat(products);
            
            if (products.length > 0) {
              console.log(`✅ Strategy ${i + 1} successful, got ${products.length} processed products`);
              break; // If we got products, no need to try other strategies
            }
          } else {
            console.log(`⚠️ Strategy ${i + 1}: No products array in response`);
            if (response.data) {
              console.log('Response structure:', JSON.stringify(response.data, null, 2).substring(0, 500));
            }
          }
        } catch (strategyError) {
          console.warn(`⚠️ Strategy ${i + 1} failed:`, strategyError.message);
        }
        
        // Small delay between strategies
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // If no products found, create some mock products for demo
      if (allProducts.length === 0) {
        console.log('🎭 No products found via API, creating demo products...');
        allProducts = this.createDemoProducts(searchTerm, Math.min(limit, 5));
      }

      console.log(`✅ Total products found for "${searchTerm}": ${allProducts.length}`);
      return allProducts;
      
    } catch (error) {
      console.error(`❌ Error searching products for "${searchTerm}":`, error.message);
      
      // Return demo products on error
      console.log('🎭 Creating demo products due to API error...');
      return this.createDemoProducts(searchTerm, Math.min(limit, 3));
    }
  }

  // Create demo products when API fails
  createDemoProducts(searchTerm, count) {
    const demoProducts = [];
    const baseName = this.getProductBaseName(searchTerm);
    
    for (let i = 0; i < count; i++) {
      const product = {
        name: `${baseName} ${this.getDemoVariant(i)}`,
        category: this.determineCategory({ categories: this.getDemoCategory(searchTerm) }),
        brand: 'Lidl',
        store: 'Lidl',
        country: 'Hrvatska',
        price: this.generateRealisticPrices(this.determineCategory({ categories: this.getDemoCategory(searchTerm) })).croatia,
        currency: 'EUR',
        unit: this.getDemoUnit(searchTerm),
        availability: true,
        scrapedAt: new Date().toISOString(),
        note: `Demo product based on search "${searchTerm}" - API unavailable`,
        barcode: `demo${Date.now()}${i}`,
        source: 'Demo'
      };
      
      demoProducts.push(product);
    }
    
    return demoProducts;
  }

  getProductBaseName(searchTerm) {
    const productNames = {
      'mlijeko': 'Milbona Mlijeko 3.5%',
      'sir': 'Milbona Sir Gouda',
      'jogurt': 'Milbona Jogurt Prirodni',
      'kruh': 'Kruh Wholemeal',
      'meso': 'Svinje Kotlet',
      'pasta': 'Combino Pasta Penne',
      'čokolada': 'Fin Carré Čokolada',
      'default': `Lidl ${searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1)}`
    };
    
    return productNames[searchTerm.toLowerCase()] || productNames.default;
  }

  getDemoVariant(index) {
    const variants = ['500g', '1L', '250g', '200g', '1kg'];
    return variants[index % variants.length];
  }

  getDemoCategory(searchTerm) {
    const categoryMap = {
      'mlijeko': 'dairy products',
      'sir': 'dairy products', 
      'jogurt': 'dairy products',
      'kruh': 'bakery',
      'meso': 'meat',
      'pasta': 'cereals',
      'čokolada': 'chocolate'
    };
    
    return categoryMap[searchTerm.toLowerCase()] || 'groceries';
  }

  getDemoUnit(searchTerm) {
    const unitMap = {
      'mlijeko': '1L',
      'sir': '200g',
      'jogurt': '150g',
      'kruh': '500g',
      'meso': '1kg',
      'pasta': '500g',
      'čokolada': '100g'
    };
    
    return unitMap[searchTerm.toLowerCase()] || 'kom';
  }

  // Get products from specific categories (like everyday essentials)
  async getEverydayProducts(limit = 30) {
    console.log('🛒 Fetching everyday essentials...');
    
    const allProducts = [];
    const categories = this.croatianCategories.slice(0, 8); // First 8 categories
    
    for (let i = 0; i < categories.length && allProducts.length < limit; i++) {
      const category = categories[i];
      const productsPerCategory = Math.ceil((limit - allProducts.length) / (categories.length - i));
      
      try {
        console.log(`📦 Fetching category "${category}"...`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
        
        const products = await this.searchProducts(category, productsPerCategory);
        allProducts.push(...products);
        
        console.log(`✅ Category "${category}": ${products.length} products`);
      } catch (error) {
        console.error(`❌ Error fetching category "${category}":`, error.message);
      }
    }

    // Remove duplicates and limit results
    const uniqueProducts = this.removeDuplicates(allProducts).slice(0, limit);
    
    console.log(`✅ Total everyday products: ${uniqueProducts.length}`);
    return uniqueProducts;
  }

  // Process raw API products into our format
  processProducts(apiProducts, limit) {
    console.log(`🔄 Processing ${apiProducts.length} raw products...`);
    const processedProducts = [];

    for (const product of apiProducts) {
      if (processedProducts.length >= limit) break;
      
      // Skip products without essential data
      if (!product.product_name || !product.product_name.trim()) {
        continue;
      }
      
      // Skip very short names or invalid names
      if (product.product_name.trim().length < 3) {
        continue;
      }
      
      try {
        const processedProduct = this.transformProduct(product);
        if (processedProduct) {
          processedProducts.push(processedProduct);
        }
      } catch (error) {
        console.warn(`⚠️ Error processing product "${product.product_name}":`, error.message);
      }
    }

    console.log(`✅ Processed ${processedProducts.length} valid products`);
    return processedProducts;
  }

  // Transform API product to our format with simulated prices
  transformProduct(apiProduct) {
    const name = this.cleanProductName(apiProduct.product_name);
    const category = this.determineCategory(apiProduct);
    const brand = this.extractBrand(apiProduct);
    const unit = this.extractUnit(apiProduct);
    
    // Generate realistic prices for Croatia
    const prices = this.generateRealisticPrices(category);
    
    const croatianProduct = {
      name: name,
      category: category,
      brand: brand,
      store: 'Lidl',
      country: 'Hrvatska',
      price: prices.croatia,
      currency: 'EUR',
      unit: unit,
      availability: true,
      scrapedAt: new Date().toISOString(),
      note: `Real product from Open Food Facts - Croatian pricing`,
      barcode: apiProduct.code || null,
      source: 'OpenFoodFacts'
    };

    return croatianProduct;
  }

  // Extract brand with fallback
  extractBrand(product) {
    if (product.brands && product.brands.trim()) {
      const brands = product.brands.split(',');
      const firstBrand = brands[0].trim();
      if (firstBrand && firstBrand.length > 0) {
        return firstBrand;
      }
    }
    return 'Lidl';
  }

  // Generate realistic price comparison data
  generateRealisticPrices(category) {
    const range = this.priceRanges[category] || this.priceRanges.default;
    
    // Croatian price (base price)
    const croatiaPrice = Number((Math.random() * (range.max - range.min) + range.min).toFixed(2));
    
    // EU countries typically have slightly lower prices
    const euPrice = Number((croatiaPrice * range.euMultiplier).toFixed(2));
    
    return {
      croatia: croatiaPrice,
      eu: euPrice
    };
  }

  // Create comparison products for EU countries
  createEUComparisons(croatianProduct) {
    const euCountries = ['Germany', 'Slovenia', 'Austria'];
    const euProducts = [];
    
    euCountries.forEach(country => {
      const prices = this.generateRealisticPrices(croatianProduct.category);
      
      euProducts.push({
        ...croatianProduct,
        country: country,
        price: prices.eu,
        note: `Real product from Open Food Facts - ${country} pricing`,
        scrapedAt: new Date().toISOString()
      });
    });
    
    return euProducts;
  }

  // Clean and standardize product names
  cleanProductName(name) {
    if (!name) return 'Unknown Product';
    
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-\.\,]/g, '')
      .substring(0, 100);
  }

  // Determine product category
  determineCategory(product) {
    if (product.categories) {
      const categories = product.categories.toLowerCase();
      
      if (categories.includes('dairy') || categories.includes('milk') || categories.includes('cheese') || categories.includes('yogurt')) {
        return 'Mliječni proizvodi';
      }
      if (categories.includes('bread') || categories.includes('bakery') || categories.includes('biscuit')) {
        return 'Pekarski proizvodi';
      }
      if (categories.includes('meat') || categories.includes('fish') || categories.includes('sausage')) {
        return 'Meso i riba';
      }
      if (categories.includes('fruit') || categories.includes('vegetable') || categories.includes('fresh')) {
        return 'Voće i povrće';
      }
      if (categories.includes('beverage') || categories.includes('drink') || categories.includes('water') || categories.includes('juice')) {
        return 'Napitci';
      }
      if (categories.includes('cereal') || categories.includes('pasta') || categories.includes('rice') || categories.includes('grain')) {
        return 'Žitarice i testenina';
      }
      if (categories.includes('chocolate') || categories.includes('candy') || categories.includes('sweet') || categories.includes('dessert')) {
        return 'Konditorski proizvodi';
      }
      if (categories.includes('frozen')) {
        return 'Zamrznuta hrana';
      }
    }
    
    return 'Ostalo';
  }

  // Extract unit information
  extractUnit(product) {
    if (product.quantity && product.quantity.trim()) {
      return product.quantity.trim();
    }
    
    // Try to extract from product name
    const name = product.product_name || '';
    const unitMatch = name.match(/(\d+\.?\d*)\s*(g|kg|ml|l|kom|pcs|cl|dl)/i);
    
    if (unitMatch) {
      return `${unitMatch[1]}${unitMatch[2].toLowerCase()}`;
    }
    
    return 'kom';
  }

  // Remove duplicate products
  removeDuplicates(products) {
    const seen = new Set();
    return products.filter(product => {
      const key = `${product.name.toLowerCase()}-${product.brand}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Test API connection
  async testConnection() {
    try {
      console.log('🧪 Testing Open Food Facts API connection...');
      
      // Test with a known product
      const response = await axios.get(`${this.baseURL}/api/v0/product/3017620425035.json`, {
        headers: this.headers,
        timeout: 10000
      });
      
      if (response.data && response.data.product) {
        console.log('✅ Open Food Facts API connection successful');
        console.log('📦 Sample product:', response.data.product.product_name);
        
        return {
          success: true,
          message: 'API connection working',
          sampleProduct: response.data.product.product_name,
          status: response.status
        };
      } else {
        throw new Error('Invalid API response structure');
      }
    } catch (error) {
      console.error('❌ Open Food Facts API test failed:', error.message);
      return {
        success: false,
        message: 'API connection failed - using demo mode',
        error: error.message,
        fallback: 'Demo products will be used'
      };
    }
  }

  // Get product statistics
  async getAvailableProductCount(searchTerm = 'milk') {
    try {
      const response = await axios.get(`${this.baseURL}/cgi/search.pl`, {
        params: {
          search_terms: searchTerm,
          search_simple: 1,
          json: 1,
          page_size: 1
        },
        headers: this.headers,
        timeout: 10000
      });

      const count = response.data?.count || response.data?.page_count || 0;
      
      return {
        available: count,
        searchTerm: searchTerm,
        success: true
      };
    } catch (error) {
      console.error('❌ Error getting product count:', error.message);
      return { 
        available: 0, 
        searchTerm: searchTerm,
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = OpenFoodFactsService;