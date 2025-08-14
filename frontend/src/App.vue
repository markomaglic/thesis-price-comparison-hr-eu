<template>
  <div id="app">
    <AppHeader />
    
    <nav class="nav">
      <button v-for="tab in tabs" :key="tab.id" @click="activeTab = tab.id"
        :class="['tab-button', { active: activeTab === tab.id }]">
        {{ tab.name }}
      </button>
    </nav>

    <main class="main">
      <!-- Dashboard Tab -->
      <DashboardTab 
        v-if="activeTab === 'dashboard'" 
        :database-products="databaseProducts"
        :last-update="lastUpdate"
        :countries="countries"
      />

      <!-- Data Fetching Tab -->
      <DataFetchingTab 
        v-if="activeTab === 'fetching'"
        :fetching-status="fetchingStatus"
        :database-products="databaseProducts"
        :search-results="searchResults"
        :search-query="searchQuery"
        :last-search-query="lastSearchQuery"
        :available-categories="availableCategories"
        :search-examples="searchExamples"
        @fetch-basic="fetchBasicProducts"
        @fetch-everyday="fetchEverydayProducts"
        @load-database="loadDatabaseProducts"
        @test-api="testAPI"
        @search-products="searchProducts"
        @search-by-category="searchByCategory"
        @quick-search="quickSearch"
        @update:search-query="searchQuery = $event"
      />

      <!-- Price Comparison Tab -->
      <PriceComparisonTab 
        v-if="activeTab === 'comparison'"
        :comparison-data="comparisonData"
        :average-price-croatia="averagePriceCroatia"
        :average-price-eu="averagePriceEU"
        :price-difference="priceDifference"
        @load-comparison="loadComparisonData"
      />

      <!-- NEW: Product Chart Tab -->
      <ProductChartTab 
        v-if="activeTab === 'product-chart'"
        :database-products="databaseProducts"
      />

      <!-- Price History Tab -->
      <PriceHistoryTab 
        v-if="activeTab === 'price-history'"
        :price-comparison-data="priceComparisonData"
        :product-price-history="productPriceHistory"
        :trending-products="trendingProducts"
        :loading-history="loadingHistory"
        :price-history-query="priceHistoryQuery"
        :last-history-query="lastHistoryQuery"
        :selected-country-filter="selectedCountryFilter"
        :max-price="maxPrice"
        :min-product-price="minProductPrice"
        :max-product-price="maxProductPrice"
        :average-product-price="averageProductPrice"
        @generate-historical="generateHistoricalData"
        @load-price-comparison="loadPriceComparison"
        @load-product-history="loadProductHistory"
        @simulate-price-update="simulatePriceUpdate"
        @update:price-history-query="priceHistoryQuery = $event"
        @update:selected-country-filter="selectedCountryFilter = $event"
      />

      <!-- API Test Tab -->
      <ApiTestTab 
        v-if="activeTab === 'api'"
        :api-response="apiResponse"
        :statistics="statistics"
        @test-endpoint="testEndpoint"
      />
    </main>
  </div>
</template>

<script>
import AppHeader from './components/AppHeader.vue'
import DashboardTab from './components/DashboardTab.vue'
import DataFetchingTab from './components/DataFetchingTab.vue'
import PriceComparisonTab from './components/PriceComparisonTab.vue'
import ProductChartTab from './components/ProductChartTab.vue'
import PriceHistoryTab from './components/PriceHistoryTab.vue'
import ApiTestTab from './components/ApiTestTab.vue'

export default {
  name: 'ThesisPriceComparisonApp',
  components: {
    AppHeader,
    DashboardTab,
    DataFetchingTab,
    PriceComparisonTab,
    ProductChartTab,
    PriceHistoryTab,
    ApiTestTab
  },
  data() {
    return {
      activeTab: 'dashboard',
      tabs: [
        { id: 'dashboard', name: '📊 Dashboard' },
        { id: 'fetching', name: '🎯 Data Fetching' },
        { id: 'comparison', name: '📊 Price Comparison' },
        { id: 'product-chart', name: '📈 Product Charts' }, // NEW TAB
        { id: 'price-history', name: '📈 Price History' },
        { id: 'api', name: '🔧 API & Stats' }
      ],
      fetchingStatus: 'idle',
      databaseProducts: [],
      comparisonData: [],
      searchResults: [],
      searchQuery: '',
      lastSearchQuery: '',
      apiResponse: null,
      statistics: null,
      databaseProductsCount: 0,
      lastUpdate: null,
      countries: ['Hrvatska', 'Germany', 'Slovenia', 'Austria'],
      searchExamples: ['sir', 'mlijeko', 'kruh', 'mrkva', 'banane', 'jogurt', 'čokolada', 'pasta'],
      availableCategories: [],
      
      // Price History Data
      priceComparisonData: [],
      productPriceHistory: [],
      trendingProducts: [],
      loadingHistory: false,
      priceHistoryQuery: '',
      lastHistoryQuery: '',
      selectedCountryFilter: '',
      maxPrice: 5,
      minProductPrice: '0.00',
      maxProductPrice: '0.00',
      averageProductPrice: '0.00'
    }
  },
  computed: {
    averagePriceCroatia() {
      const croatianProducts = this.databaseProducts.filter(p => p.country === 'Hrvatska');
      if (croatianProducts.length === 0) return '0.00';
      const total = croatianProducts.reduce((sum, product) => sum + product.price, 0);
      return (total / croatianProducts.length).toFixed(2);
    },
    averagePriceEU() {
      const euProducts = this.databaseProducts.filter(p => p.country !== 'Hrvatska');
      if (euProducts.length === 0) return '0.00';
      const total = euProducts.reduce((sum, product) => sum + product.price, 0);
      return (total / euProducts.length).toFixed(2);
    },
    priceDifference() {
      const hrPrice = parseFloat(this.averagePriceCroatia);
      const euPrice = parseFloat(this.averagePriceEU);
      if (euPrice === 0) return 0;
      return (((hrPrice - euPrice) / euPrice) * 100).toFixed(1);
    },
    categoryBreakdown() {
      const breakdown = {};
      this.databaseProducts.forEach(product => {
        breakdown[product.category] = (breakdown[product.category] || 0) + 1;
      });
      return breakdown;
    },
    countryBreakdown() {
      const breakdown = {};
      this.databaseProducts.forEach(product => {
        breakdown[product.country] = (breakdown[product.country] || 0) + 1;
      });
      return breakdown;
    }
  },
  async mounted() {
    await this.loadDatabaseProducts();
    await this.loadComparisonData();
    await this.loadStatistics();
    await this.loadCategories();
  },
  methods: {
    // Database Methods
    async loadDatabaseProducts() {
      try {
        const response = await fetch('http://localhost:3001/api/products/database');
        const data = await response.json();

        if (data.success) {
          this.databaseProducts = data.data;
          this.databaseProductsCount = data.count;
          this.lastUpdate = data.lastUpdate;
        }
      } catch (error) {
        console.error('Error loading database products:', error);
      }
    },

    async loadComparisonData() {
      try {
        console.log('🔄 Loading comparison data...');
        const response = await fetch('http://localhost:3001/api/products/comparison');
        const data = await response.json();

        if (data.success) {
          this.comparisonData = data.data;
          console.log(`✅ Loaded ${data.count} products for comparison`);
        } else {
          console.error('Comparison failed:', data.message);
          alert(`❌ Comparison failed: ${data.message}`);
        }
      } catch (error) {
        console.error('Error loading comparison data:', error);
        alert('❌ Error loading comparison data');
      }
    },

    async loadStatistics() {
      try {
        const response = await fetch('http://localhost:3001/api/stats');
        const data = await response.json();

        if (data.success) {
          this.statistics = data.statistics;
        }
      } catch (error) {
        console.error('Error loading statistics:', error);
      }
    },

    async loadCategories() {
      try {
        const response = await fetch('http://localhost:3001/api/categories');
        const data = await response.json();

        if (data.success) {
          this.availableCategories = data.data;
        }
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    },

    // Fetching Methods
    async fetchBasicProducts() {
      this.fetchingStatus = 'loading';
      try {
        const response = await fetch('http://localhost:3001/api/fetch/basic');
        const data = await response.json();

        if (data.success) {
          alert(`✅ Basic fetch completed! Found ${data.count} products, saved ${data.saved} to database`);
          await this.loadDatabaseProducts();
          await this.loadComparisonData();
          await this.loadStatistics();
        } else {
          alert(`❌ ${data.message}`);
        }
      } catch (error) {
        console.error('Error during basic fetch:', error);
        alert('❌ Error during basic fetch');
      } finally {
        this.fetchingStatus = 'idle';
      }
    },

    async fetchEverydayProducts() {
      this.fetchingStatus = 'loading';
      try {
        const response = await fetch('http://localhost:3001/api/fetch/everyday');
        const data = await response.json();

        if (data.success) {
          alert(`✅ Everyday fetch completed! Found ${data.uniqueProducts} unique products with ${data.totalEntries} total entries`);
          await this.loadDatabaseProducts();
          await this.loadComparisonData();
          await this.loadStatistics();
        } else {
          alert(`❌ ${data.message}`);
        }
      } catch (error) {
        console.error('Error during everyday fetch:', error);
        alert('❌ Error during everyday fetch');
      } finally {
        this.fetchingStatus = 'idle';
      }
    },

    // Search Methods
    async searchProducts() {
      if (!this.searchQuery || this.searchQuery.length < 2) return;

      this.fetchingStatus = 'loading';
      this.lastSearchQuery = this.searchQuery;

      try {
        const response = await fetch(`http://localhost:3001/api/search/database/${encodeURIComponent(this.searchQuery)}?limit=20`);
        const data = await response.json();

        if (data.success) {
          this.searchResults = data.data;
          console.log(`✅ Found ${data.count} products in database for "${this.searchQuery}"`);
          if (data.count > 0) {
            alert(`✅ Found ${data.count} products in database for "${this.searchQuery}"`);
          } else {
            alert(`ℹ️ No products found for "${this.searchQuery}". Try fetching more data first.`);
          }
        } else {
          alert(`❌ ${data.message}`);
        }
      } catch (error) {
        console.error('Error searching database:', error);
        alert('❌ Database search error');
      } finally {
        this.fetchingStatus = 'idle';
      }
    },

    async searchByCategory(category) {
      this.fetchingStatus = 'loading';

      try {
        const response = await fetch(`http://localhost:3001/api/search/category/${encodeURIComponent(category)}?limit=50`);
        const data = await response.json();

        if (data.success) {
          this.searchResults = data.data;
          this.lastSearchQuery = `Category: ${category}`;
          alert(`✅ Found ${data.count} products in category "${category}"`);
        } else {
          alert(`❌ ${data.message}`);
        }
      } catch (error) {
        console.error('Error searching category:', error);
        alert('❌ Category search error');
      } finally {
        this.fetchingStatus = 'idle';
      }
    },

    quickSearch(term) {
      this.searchQuery = term;
      this.searchProducts();
    },

    // API Testing Methods
    async testAPI() {
      this.fetchingStatus = 'loading';
      try {
        const response = await fetch('http://localhost:3001/api/fetch/test');
        const data = await response.json();

        if (data.success) {
          console.log('Test results:', data);
          alert('✅ Open Food Facts API test completed! Check console for details.');
        }
      } catch (error) {
        console.error('Error testing API:', error);
        alert('❌ API test error');
      } finally {
        this.fetchingStatus = 'idle';
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

    // Price History Methods
    async generateHistoricalData() {
      this.loadingHistory = true;
      try {
        const response = await fetch('http://localhost:3001/api/prices/generate-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ monthsBack: 12 })
        });

        const data = await response.json();

        if (data.success) {
          alert(`✅ Generated ${data.data.insertedCount} historical price entries for ${data.data.productsProcessed} products!`);
          await this.loadPriceComparison();
          await this.loadTrendingProducts();
        } else {
          alert(`❌ ${data.message}`);
        }
      } catch (error) {
        console.error('Error generating historical data:', error);
        alert('❌ Error generating historical data');
      } finally {
        this.loadingHistory = false;
      }
    },

    async loadPriceComparison() {
      try {
        const response = await fetch('http://localhost:3001/api/prices/comparison-over-time?monthsBack=12');
        const data = await response.json();

        if (data.success) {
          this.priceComparisonData = data.data;
          this.calculateMaxPrice();
          console.log(`✅ Loaded price comparison data for ${data.data.length} months`);
        }
      } catch (error) {
        console.error('Error loading price comparison:', error);
      }
    },

    async loadProductHistory() {
      if (!this.priceHistoryQuery) return;

      try {
        const country = this.selectedCountryFilter ? `&country=${this.selectedCountryFilter}` : '';
        const response = await fetch(`http://localhost:3001/api/prices/history/${encodeURIComponent(this.priceHistoryQuery)}?monthsBack=12${country}`);
        const data = await response.json();

        if (data.success) {
          this.productPriceHistory = data.data.sort((a, b) => new Date(a.date) - new Date(b.date));
          this.lastHistoryQuery = this.priceHistoryQuery;
          this.calculateProductPriceStats();
          console.log(`✅ Loaded ${data.dataPoints} price history points for "${this.priceHistoryQuery}"`);
        } else {
          alert(data.message);
          this.productPriceHistory = [];
        }
      } catch (error) {
        console.error('Error loading product history:', error);
        alert('❌ Error loading product price history');
      }
    },

    async loadTrendingProducts() {
      try {
        const response = await fetch('http://localhost:3001/api/prices/trending?monthsBack=6');
        const data = await response.json();

        if (data.success) {
          this.trendingProducts = data.data;
          console.log(`✅ Loaded ${data.data.length} trending products`);
        }
      } catch (error) {
        console.error('Error loading trending products:', error);
      }
    },

    async simulatePriceUpdate() {
      try {
        const response = await fetch('http://localhost:3001/api/prices/update-simulation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (data.success) {
          alert(`✅ Updated prices for ${data.data.updatedCount} products!`);
          await this.loadPriceComparison();
          await this.loadTrendingProducts();
        } else {
          alert(`❌ ${data.message}`);
        }
      } catch (error) {
        console.error('Error simulating price update:', error);
        alert('❌ Error simulating price update');
      }
    },

    // Utility Methods
    calculateMaxPrice() {
      let max = 0;
      this.priceComparisonData.forEach(dataPoint => {
        Object.values(dataPoint.countries || {}).forEach(countryData => {
          const price = parseFloat(countryData.avgPrice);
          if (price > max) max = price;
        });
      });
      this.maxPrice = Math.ceil(max);
    },

    calculateProductPriceStats() {
      if (this.productPriceHistory.length === 0) return;

      const prices = this.productPriceHistory.map(entry => entry.price);
      this.minProductPrice = Math.min(...prices).toFixed(2);
      this.maxProductPrice = Math.max(...prices).toFixed(2);
      this.averageProductPrice = (prices.reduce((sum, price) => sum + price, 0) / prices.length).toFixed(2);
    },

    formatMonth(monthString) {
      const date = new Date(monthString + '-01');
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    },

    getPriceDifference(price1, price2) {
      if (price2 === 0) return '0';
      return (((price1 - price2) / price2) * 100).toFixed(1);
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

/* Keep your existing styles */
.positive {
  color: #ff6b6b !important;
}

.negative {
  color: #51cf66 !important;
}
</style>