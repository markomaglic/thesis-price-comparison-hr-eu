<template>
  <div id="app">
    <header class="header">
      <h1>🛒 Lidl Price Scraper</h1>
      <p>Diplomski rad - Analiza cijena Lidl proizvoda (EUR)</p>
    </header>

    <nav class="nav">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="['tab-button', { active: activeTab === tab.id }]"
      >
        {{ tab.name }}
      </button>
    </nav>

    <main class="main">
      <!-- Dashboard Tab -->
      <div v-if="activeTab === 'dashboard'" class="tab-content">
        <h2>📊 Dashboard</h2>
        
        <div class="dashboard-stats">
          <div class="stat-card">
            <h3>🛒 Basic Products</h3>
            <span class="stat-number">{{ basicProductsCount }}</span>
            <small>Simple search results</small>
          </div>
          <div class="stat-card">
            <h3>🥖 Everyday Products</h3>
            <span class="stat-number">{{ everydayProductsCount }}</span>
            <small>Comprehensive essentials</small>
          </div>
          <div class="stat-card">
            <h3>💰 Currency</h3>
            <span class="stat-number">EUR</span>
            <small>Croatia uses Euro</small>
          </div>
          <div class="stat-card">
            <h3>⏰ Last Update</h3>
            <span class="stat-number">{{ formatTime(lastUpdate) }}</span>
            <small>{{ lastUpdate ? formatDate(lastUpdate) : 'Never' }}</small>
          </div>
        </div>

        <div v-if="allProducts.length > 0" class="products-summary">
          <h3>📦 All Products Overview</h3>
          <div class="price-stats">
            <div class="price-stat">
              <span class="label">Average Price:</span>
              <span class="value">{{ averagePrice }} EUR</span>
            </div>
            <div class="price-stat">
              <span class="label">Cheapest:</span>
              <span class="value">{{ cheapestProduct?.price || 'N/A' }} EUR</span>
              <small>{{ cheapestProduct?.name || 'N/A' }}</small>
            </div>
            <div class="price-stat">
              <span class="label">Most Expensive:</span>
              <span class="value">{{ expensiveProduct?.price || 'N/A' }} EUR</span>
              <small>{{ expensiveProduct?.name || 'N/A' }}</small>
            </div>
          </div>
          
          <div class="category-breakdown">
            <h4>Categories</h4>
            <div class="category-items">
              <div v-for="(count, category) in categoryBreakdown" :key="category" class="category-pill">
                <span class="category-name">{{ category }}</span>
                <span class="category-count">{{ count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Scraping Tab -->
      <div v-if="activeTab === 'scraping'" class="tab-content">
        <h2>🕷️ Lidl Web Scraping</h2>
        
        <div class="scraping-controls">
          <div class="scraping-info">
            <div class="info-box">
              <h4>🎯 Basic Scraping</h4>
              <p>Searches for <strong>sir, mlijeko, kruh</strong> - quick test of key products</p>
            </div>
            <div class="info-box">
              <h4>🛒 Everyday Scraping</h4>
              <p>Comprehensive search for <strong>16 everyday essentials</strong> - complete shopping basket</p>
            </div>
          </div>
          
          <div class="scraping-actions">
            <button 
              @click="startBasicScraping" 
              :disabled="scrapingStatus === 'loading'"
              class="scraping-button basic"
            >
              <span class="button-icon">🎯</span>
              {{ scrapingStatus === 'loading' ? 'Scraping...' : 'Basic Lidl Scraping' }}
              <small>sir, mlijeko, kruh</small>
            </button>
            
            <button 
              @click="startEverydayScraping" 
              :disabled="scrapingStatus === 'loading'"
              class="scraping-button everyday"
            >
              <span class="button-icon">🛒</span>
              {{ scrapingStatus === 'loading' ? 'Scraping...' : 'Everyday Essentials' }}
              <small>16 product categories</small>
            </button>
            
            <button @click="loadScrapedProducts" class="scraping-button secondary">
              <span class="button-icon">📦</span>
              Load Scraped Data
            </button>
            
            <button @click="testScraper" class="scraping-button secondary">
              <span class="button-icon">🧪</span>
              Test Scraper
            </button>
          </div>
          
          <div class="search-section">
            <h3>🔍 Search Specific Products</h3>
            <div class="search-controls">
              <input 
                v-model="searchQuery" 
                @keyup.enter="searchProducts"
                placeholder="Search for specific product (e.g., sir, mrkva, jogurt...)"
                class="search-input"
              >
              <button @click="searchProducts" :disabled="!searchQuery || searchQuery.length < 2" class="search-button">
                <span class="button-icon">🔍</span>
                Search
              </button>
            </div>
            <div class="search-examples">
              <span>Try: </span>
              <button v-for="example in searchExamples" :key="example" @click="quickSearch(example)" class="example-button">
                {{ example }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="scrapingStatus === 'loading'" class="scraping-progress">
          <div class="spinner"></div>
          <p>Scraping in progress... Please wait</p>
        </div>

        <!-- Scraped Products Results -->
        <div v-if="allProducts.length > 0" class="scraped-results">
          <h3>📊 Scraped Products ({{ allProducts.length }})</h3>
          <div class="results-info">
            <div class="data-source-info">
              <span class="source-label">Data Source:</span>
              <span :class="['source-value', dataSource]">{{ dataSourceLabel }}</span>
            </div>
            <div class="currency-info">
              <span class="currency-label">Currency:</span>
              <span class="currency-value">EUR (Croatia)</span>
            </div>
          </div>
          
          <div class="products-grid">
            <div v-for="product in allProducts" :key="product.name + product.scrapedAt" class="product-card">
              <div class="product-header">
                <h4>{{ product.name }}</h4>
                <span class="category-badge">{{ product.category }}</span>
              </div>
              <div class="product-price">
                <span class="price">{{ product.price }} {{ product.currency }}</span>
                <span v-if="product.originalPrice" class="original-price">
                  Before: {{ product.originalPrice }} {{ product.currency }}
                </span>
                <span v-if="product.unit" class="unit">{{ product.unit }}</span>
              </div>
              <div class="product-meta">
                <div class="store-info">
                  <span class="store">{{ product.store }}</span>
                  <span class="country">{{ product.country }}</span>
                </div>
                <div class="availability" :class="{ available: product.availability }">
                  {{ product.availability ? '✅ Available' : '❌ Unavailable' }}
                </div>
              </div>
              <div v-if="product.note" class="product-note">
                <small>{{ product.note }}</small>
              </div>
              <div class="scraped-time">
                {{ formatDateTime(product.scrapedAt) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Search Results -->
        <div v-if="searchResults.length > 0" class="search-results">
          <h3>🔍 Search Results: "{{ lastSearchQuery }}" ({{ searchResults.length }})</h3>
          <div class="products-grid">
            <div v-for="product in searchResults" :key="product.name + product.scrapedAt" class="product-card search-result">
              <div class="product-header">
                <h4>{{ product.name }}</h4>
                <span class="category-badge">{{ product.category }}</span>
              </div>
              <div class="product-price">
                <span class="price">{{ product.price }} {{ product.currency }}</span>
                <span v-if="product.unit" class="unit">{{ product.unit }}</span>
              </div>
              <div class="product-meta">
                <span class="store">{{ product.store }}</span>
              </div>
              <div v-if="product.note" class="product-note">
                <small>{{ product.note }}</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- API Test Tab -->
      <div v-if="activeTab === 'api'" class="tab-content">
        <h2>🔧 API Testing</h2>
        <div class="api-tests">
          <div class="api-section">
            <h3>📊 Data Endpoints</h3>
            <button @click="testEndpoint('/api/products')" class="test-button">
              Test Products API
            </button>
            <button @click="testEndpoint('/api/products/scraped')" class="test-button">
              Test Scraped Products API
            </button>
            <button @click="testEndpoint('/api/scrape/status')" class="test-button">
              Test Status API
            </button>
          </div>
          
          <div class="api-section">
            <h3>🕷️ Scraping Endpoints</h3>
            <button @click="testEndpoint('/api/scrape/lidl')" class="test-button">
              Test Basic Scraping API
            </button>
            <button @click="testEndpoint('/api/scrape/lidl/everyday')" class="test-button">
              Test Everyday Scraping API
            </button>
            <button @click="testEndpoint('/api/scrape/search/sir')" class="test-button">
              Test Search API (sir)
            </button>
          </div>
          
          <div class="api-section">
            <h3>🔧 Utility Endpoints</h3>
            <button @click="testEndpoint('/health')" class="test-button">
              Test Health API
            </button>
            <button @click="testEndpoint('/api/scrape/check-access')" class="test-button">
              Test Access Check API
            </button>
          </div>
        </div>
        
        <div v-if="apiResponse" class="api-response">
          <h4>API Response:</h4>
          <div class="response-meta">
            <span>Status: {{ apiResponse.status || 'Unknown' }}</span>
            <span>Time: {{ formatTime(new Date()) }}</span>
          </div>
          <pre>{{ JSON.stringify(apiResponse, null, 2) }}</pre>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
export default {
  name: 'LidlScraperApp',
  data() {
    return {
      activeTab: 'dashboard',
      loading: false,
      tabs: [
        { id: 'dashboard', name: '📊 Dashboard' },
        { id: 'scraping', name: '🕷️ Scraping' },
        { id: 'api', name: '🔧 API Test' }
      ],
      scrapingStatus: 'idle',
      allProducts: [],
      searchResults: [],
      searchQuery: '',
      lastSearchQuery: '',
      apiResponse: null,
      basicProductsCount: 0,
      everydayProductsCount: 0,
      lastUpdate: null,
      dataSource: 'none',
      searchExamples: ['sir', 'mlijeko', 'kruh', 'mrkva', 'banane', 'jogurt']
    }
  },
  computed: {
    averagePrice() {
      if (this.allProducts.length === 0) return '0.00';
      const total = this.allProducts.reduce((sum, product) => sum + product.price, 0);
      return (total / this.allProducts.length).toFixed(2);
    },
    cheapestProduct() {
      if (this.allProducts.length === 0) return null;
      return this.allProducts.reduce((min, product) => 
        product.price < min.price ? product : min
      );
    },
    expensiveProduct() {
      if (this.allProducts.length === 0) return null;
      return this.allProducts.reduce((max, product) => 
        product.price > max.price ? product : max
      );
    },
    categoryBreakdown() {
      const breakdown = {};
      this.allProducts.forEach(product => {
        breakdown[product.category] = (breakdown[product.category] || 0) + 1;
      });
      return breakdown;
    },
    dataSourceLabel() {
      const labels = {
        'everyday': '🛒 Everyday Essentials',
        'regular': '🎯 Basic Search',
        'search': '🔍 Search Results',
        'none': '❌ No Data'
      };
      return labels[this.dataSource] || 'Unknown';
    }
  },
  async mounted() {
    await this.loadScrapedProducts();
    await this.loadStatus();
  },
  methods: {
    async loadScrapedProducts() {
      try {
        const response = await fetch('http://localhost:3001/api/products/scraped');
        const data = await response.json();
        
        if (data.success) {
          this.allProducts = data.data;
          this.dataSource = data.dataSource || 'regular';
          this.lastUpdate = data.lastUpdate;
        }
      } catch (error) {
        console.error('Error loading scraped products:', error);
      }
    },

    async loadStatus() {
      try {
        const response = await fetch('http://localhost:3001/api/scrape/status');
        const data = await response.json();
        
        if (data.success) {
          this.basicProductsCount = data.basicProductsCount || 0;
          this.everydayProductsCount = data.everydayProductsCount || 0;
          this.lastUpdate = data.lastEverydayUpdate || data.lastUpdate;
        }
      } catch (error) {
        console.error('Error loading status:', error);
      }
    },

    async startBasicScraping() {
      this.scrapingStatus = 'loading';
      try {
        const response = await fetch('http://localhost:3001/api/scrape/lidl');
        const data = await response.json();
        
        if (data.success) {
          this.allProducts = data.data;
          this.dataSource = 'regular';
          this.basicProductsCount = data.count;
          alert(`✅ Basic scraping completed! Found ${data.count} products`);
          await this.loadStatus();
        } else {
          alert(`❌ ${data.message}`);
        }
      } catch (error) {
        console.error('Error during basic scraping:', error);
        alert('❌ Error during basic scraping');
      } finally {
        this.scrapingStatus = 'idle';
      }
    },

    async startEverydayScraping() {
      this.scrapingStatus = 'loading';
      try {
        const response = await fetch('http://localhost:3001/api/scrape/lidl/everyday');
        const data = await response.json();
        
        if (data.success) {
          this.allProducts = data.data;
          this.dataSource = 'everyday';
          this.everydayProductsCount = data.count;
          alert(`✅ Everyday scraping completed! Found ${data.count} products across ${data.categories} categories`);
          await this.loadStatus();
        } else {
          alert(`❌ ${data.message}`);
        }
      } catch (error) {
        console.error('Error during everyday scraping:', error);
        alert('❌ Error during everyday scraping');
      } finally {
        this.scrapingStatus = 'idle';
      }
    },

    async searchProducts() {
      if (!this.searchQuery || this.searchQuery.length < 2) return;
      
      this.scrapingStatus = 'loading';
      this.lastSearchQuery = this.searchQuery;
      
      try {
        const response = await fetch(`http://localhost:3001/api/scrape/search/${encodeURIComponent(this.searchQuery)}?limit=20`);
        const data = await response.json();
        
        if (data.success) {
          this.searchResults = data.data;
          this.dataSource = 'search';
        } else {
          alert(`❌ ${data.message}`);
        }
      } catch (error) {
        console.error('Error searching products:', error);
        alert('❌ Search error');
      } finally {
        this.scrapingStatus = 'idle';
      }
    },

    quickSearch(term) {
      this.searchQuery = term;
      this.searchProducts();
    },

    async testScraper() {
      this.scrapingStatus = 'loading';
      try {
        const response = await fetch('http://localhost:3001/api/scrape/test');
        const data = await response.json();
        
        if (data.success) {
          console.log('Test results:', data.data);
          alert('✅ Scraper test completed! Check console for details.');
        }
      } catch (error) {
        console.error('Error testing scraper:', error);
        alert('❌ Test error');
      } finally {
        this.scrapingStatus = 'idle';
      }
    },
    
    async testEndpoint(endpoint) {
      try {
        const response = await fetch(`http://localhost:3001${endpoint}`);
        const data = await response.json();
        this.apiResponse = {
          status: response.status,
          data: data,
          endpoint: endpoint
        };
      } catch (error) {
        this.apiResponse = { 
          error: error.message,
          endpoint: endpoint,
          status: 'Error'
        };
      }
    },
    
    formatDate(dateString) {
      if (!dateString) return 'Never';
      return new Date(dateString).toLocaleDateString('hr-HR');
    },

    formatTime(dateString) {
      if (!dateString) return '--:--';
      return new Date(dateString).toLocaleTimeString('hr-HR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    },

    formatDateTime(dateString) {
      if (!dateString) return 'Unknown';
      return new Date(dateString).toLocaleString('hr-HR');
    }
  }
}
</script>

<style>
/* Import external CSS */
@import '@/assets/styles/main.css';

/* Additional styles for new components */
.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: rgba(255,255,255,0.1);
  border-radius: 15px;
  padding: 1.5rem;
  text-align: center;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.2);
}

.stat-card h3 {
  margin-bottom: 0.5rem;
  color: rgba(255,255,255,0.9);
  font-size: 1rem;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: bold;
  color: #90EE90;
  display: block;
  margin-bottom: 0.5rem;
}

.stat-card small {
  color: rgba(255,255,255,0.7);
  font-size: 0.8rem;
}

.products-summary {
  background: rgba(255,255,255,0.1);
  border-radius: 15px;
  padding: 2rem;
  margin-top: 2rem;
}

.price-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.price-stat {
  background: rgba(0,0,0,0.2);
  border-radius: 10px;
  padding: 1rem;
  text-align: center;
}

.price-stat .label {
  display: block;
  font-size: 0.9rem;
  color: rgba(255,255,255,0.8);
  margin-bottom: 0.5rem;
}

.price-stat .value {
  font-size: 1.8rem;
  font-weight: bold;
  color: #FFD700;
  display: block;
  margin-bottom: 0.25rem;
}

.price-stat small {
  color: rgba(255,255,255,0.6);
  font-size: 0.8rem;
  display: block;
}

.category-breakdown {
  background: rgba(0,0,0,0.2);
  border-radius: 10px;
  padding: 1.5rem;
}

.category-breakdown h4 {
  margin-bottom: 1rem;
  color: rgba(255,255,255,0.9);
}

.category-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.category-pill {
  background: rgba(255,255,255,0.1);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.category-name {
  font-weight: 500;
  color: rgba(255,255,255,0.9);
}

.category-count {
  background: rgba(0,0,0,0.3);
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
  font-size: 0.8rem;
  color: #90EE90;
  font-weight: bold;
}

.scraping-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.info-box {
  background: rgba(0,0,0,0.2);
  border-radius: 10px;
  padding: 1.5rem;
}

.info-box h4 {
  margin-bottom: 0.5rem;
  color: rgba(255,255,255,0.9);
}

.info-box p {
  color: rgba(255,255,255,0.8);
  line-height: 1.4;
}

.scraping-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.scraping-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1rem;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
  color: white;
  min-height: 100px;
  justify-content: center;
}

.scraping-button:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.3);
}

.scraping-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.scraping-button.basic {
  background: linear-gradient(45deg, #667eea, #764ba2);
}

.scraping-button.everyday {
  background: linear-gradient(45deg, #FF6B35, #F7931E);
}

.scraping-button.secondary {
  background: rgba(255,255,255,0.2);
}

.button-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.scraping-button small {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  opacity: 0.8;
}

.search-examples {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.example-button {
  background: rgba(255,255,255,0.1);
  border: none;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  color: white;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s ease;
}

.example-button:hover {
  background: rgba(255,255,255,0.2);
}

.results-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(0,0,0,0.2);
  border-radius: 10px;
}

.source-label, .currency-label {
  font-weight: 500;
  margin-right: 0.5rem;
}

.source-value {
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-weight: 500;
}

.source-value.everyday {
  background: linear-gradient(45deg, #FF6B35, #F7931E);
  color: white;
}

.source-value.regular {
  background: linear-gradient(45deg, #667eea, #764ba2);
  color: white;
}

.source-value.search {
  background: linear-gradient(45deg, #4CAF50, #45a049);
  color: white;
}

.currency-value {
  color: #FFD700;
  font-weight: bold;
}

.product-card {
  background: rgba(255,255,255,0.1);
  border-radius: 15px;
  padding: 1.5rem;
  transition: all 0.3s ease;
  border: 1px solid rgba(255,255,255,0.2);
}

.product-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.2);
  background: rgba(255,255,255,0.15);
}

.product-card.search-result {
  border-left: 4px solid #4CAF50;
}

.product-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.product-header h4 {
  margin: 0;
  font-size: 1.1rem;
  flex: 1;
  color: rgba(255,255,255,0.95);
}

.category-badge {
  background: rgba(0,0,0,0.3);
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  white-space: nowrap;
  color: rgba(255,255,255,0.8);
}

.product-price {
  margin-bottom: 1rem;
}

.price {
  font-size: 1.5rem;
  font-weight: bold;
  color: #90EE90;
  margin-right: 1rem;
}

.original-price {
  text-decoration: line-through;
  color: rgba(255,255,255,0.6);
  font-size: 0.9rem;
  margin-right: 0.5rem;
}

.unit {
  background: rgba(255,255,255,0.2);
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
  font-size: 0.8rem;
  color: rgba(255,255,255,0.8);
}

.product-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
}

.store-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.store {
  font-weight: 500;
  color: #FFD700;
}

.country {
  color: rgba(255,255,255,0.7);
  font-size: 0.8rem;
}

.availability.available {
  color: #90EE90;
  font-size: 0.8rem;
}

.product-note {
  background: rgba(0,0,0,0.2);
  padding: 0.5rem;
  border-radius: 5px;
  margin-bottom: 0.5rem;
  font-style: italic;
}

.product-note small {
  color: rgba(255,255,255,0.7);
}

.scraped-time {
  color: rgba(255,255,255,0.5);
  font-size: 0.75rem;
  text-align: right;
}

.api-tests {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.api-section {
  background: rgba(255,255,255,0.1);
  border-radius: 15px;
  padding: 1.5rem;
}

.api-section h3 {
  margin-bottom: 1rem;
  color: rgba(255,255,255,0.9);
}

.api-section .test-button {
  margin: 0.5rem 0.5rem 0.5rem 0;
  padding: 0.75rem 1.5rem;
  border: none;
  background: rgba(255,255,255,0.2);
  color: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.api-section .test-button:hover {
  background: rgba(255,255,255,0.3);
}

.api-response {
  background: rgba(0,0,0,0.3);
  border-radius: 15px;
  padding: 1.5rem;
  margin-top: 2rem;
}

.response-meta {
  display: flex;
  gap: 2rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: rgba(255,255,255,0.8);
}

.api-response pre {
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  padding: 1rem;
  max-height: 400px;
  overflow-y: auto;
  font-size: 0.8rem;
  line-height: 1.4;
}

@media (max-width: 768px) {
  .dashboard-stats {
    grid-template-columns: 1fr 1fr;
  }
  
  .price-stats {
    grid-template-columns: 1fr;
  }
  
  .scraping-actions {
    grid-template-columns: 1fr;
  }
  
  .results-info {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .category-items {
    flex-direction: column;
  }
}
</style>