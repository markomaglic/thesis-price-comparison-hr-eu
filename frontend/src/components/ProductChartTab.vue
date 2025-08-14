<template>
  <div class="tab-content">
    <h2>📈 Product Price Charts</h2>
    
    <div class="chart-info">
      <div class="info-box">
        <h4>🎯 Interactive Price Comparison</h4>
        <p>Select any product from your database and see its <strong>price across different countries</strong> in beautiful charts</p>
      </div>
      <div class="info-box">
        <h4>📊 Multiple Chart Types</h4>
        <p>Switch between <strong>Bar Charts</strong> and <strong>Line Charts</strong> to visualize price differences your way</p>
      </div>
      <div class="info-box">
        <h4>🔍 Real Data Analysis</h4>
        <p>Based on your <strong>real database products</strong> with Croatian vs EU pricing comparisons</p>
      </div>
    </div>

    <!-- Product Selection -->
    <div class="chart-controls">
      <div class="control-section">
        <h3>🛒 Select Product to Analyze</h3>
        <div class="product-selection">
          <select v-model="selectedProduct" @change="fetchProductPrices" class="product-selector">
            <option value="">Choose a product...</option>
            <option v-for="product in uniqueProducts" :key="product" :value="product">
              {{ product }}
            </option>
          </select>
          
          <div class="chart-type-buttons">
            <button 
              @click="chartType = 'bar'" 
              :class="['chart-type-btn', { active: chartType === 'bar' }]"
            >
              📊 Bar Chart
            </button>
            <button 
              @click="chartType = 'line'" 
              :class="['chart-type-btn', { active: chartType === 'line' }]"
            >
              📈 Line Chart
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading price data for {{ selectedProduct }}...</p>
    </div>

    <!-- Chart Display -->
    <div v-if="!loading && chartData.length > 0" class="chart-section">
      <div class="chart-header">
        <h3>💰 {{ selectedProduct }}</h3>
        <p>Price comparison across {{ chartData.length }} countries</p>
      </div>

      <!-- Simple Chart (you can replace with Chart.js or D3) -->
      <div class="simple-chart-container">
        <div v-if="chartType === 'bar'" class="bar-chart">
          <div class="chart-title">📊 Price Comparison - Bar Chart</div>
          <div class="bars-container">
            <div v-for="item in chartData" :key="item.country" class="bar-item">
              <div class="country-label">
                <span class="flag">{{ getCountryFlag(item.country) }}</span>
                <span class="country-name">{{ item.country }}</span>
              </div>
              <div class="bar-wrapper">
                <div 
                  class="price-bar" 
                  :style="{ 
                    height: `${(item.price / maxPrice) * 200}px`,
                    backgroundColor: getCountryColor(item.country)
                  }"
                  :title="`€${item.price}`"
                >
                  <span class="price-label">€{{ item.price }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="chartType === 'line'" class="line-chart">
          <div class="chart-title">📈 Price Comparison - Line Chart</div>
          <svg class="line-svg" width="100%" height="300" viewBox="0 0 800 300">
            <!-- Grid lines -->
            <defs>
              <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            <!-- Price line -->
            <polyline
              :points="linePoints"
              fill="none"
              stroke="#90EE90"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            
            <!-- Data points -->
            <circle
              v-for="(point, index) in chartData"
              :key="point.country"
              :cx="100 + index * 150"
              :cy="250 - (point.price / maxPrice) * 200"
              r="6"
              :fill="getCountryColor(point.country)"
              stroke="white"
              stroke-width="2"
            />
            
            <!-- Labels -->
            <text
              v-for="(point, index) in chartData"
              :key="`label-${point.country}`"
              :x="100 + index * 150"
              :y="280"
              text-anchor="middle"
              fill="white"
              font-size="12"
            >
              {{ getCountryFlag(point.country) }} {{ point.country }}
            </text>
            
            <!-- Price labels -->
            <text
              v-for="(point, index) in chartData"
              :key="`price-${point.country}`"
              :x="100 + index * 150"
              :y="250 - (point.price / maxPrice) * 200 - 15"
              text-anchor="middle"
              fill="#90EE90"
              font-size="14"
              font-weight="bold"
            >
              €{{ point.price }}
            </text>
          </svg>
        </div>
      </div>

      <!-- Price Analysis -->
      <div class="price-analysis">
        <h4>📊 Price Analysis</h4>
        <div class="analysis-grid">
          <div class="analysis-item highest">
            <span class="label">Highest Price:</span>
            <span class="value">
              {{ getCountryFlag(highestPriceCountry.country) }} {{ highestPriceCountry.country }} - €{{ highestPriceCountry.price }}
            </span>
          </div>
          <div class="analysis-item lowest">
            <span class="label">Lowest Price:</span>
            <span class="value">
              {{ getCountryFlag(lowestPriceCountry.country) }} {{ lowestPriceCountry.country }} - €{{ lowestPriceCountry.price }}
            </span>
          </div>
          <div class="analysis-item difference">
            <span class="label">Price Difference:</span>
            <span class="value">
              €{{ priceDifference }} ({{ pricePercentageDifference }}%)
            </span>
          </div>
          <div class="analysis-item average">
            <span class="label">Average Price:</span>
            <span class="value">€{{ averagePrice }}</span>
          </div>
        </div>
      </div>

      <!-- Country Details -->
      <div class="country-details">
        <h4>🌍 Country Breakdown</h4>
        <div class="country-cards">
          <div v-for="item in chartData" :key="item.country" class="country-card">
            <div class="country-header">
              <span class="country-flag">{{ getCountryFlag(item.country) }}</span>
              <span class="country-name">{{ item.country }}</span>
            </div>
            <div class="country-price" :style="{ color: getCountryColor(item.country) }">
              €{{ item.price }}
            </div>
            <div class="price-comparison">
              <span v-if="item.country === 'Hrvatska'" class="price-note">Base Price</span>
              <span v-else class="price-note">
                {{ item.price > croatianPrice ? '+' : '' }}{{ getPriceDifference(item.price, croatianPrice) }}% vs Croatia
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && !selectedProduct" class="empty-chart-state">
      <div class="empty-content">
        <span class="empty-icon">📈</span>
        <h3>Select a Product to View Charts</h3>
        <p>Choose any product from the dropdown above to see its price comparison across countries</p>
        <div class="available-products">
          <span>Available products: {{ uniqueProducts.length }}</span>
        </div>
      </div>
    </div>

    <!-- No Data State -->
    <div v-if="!loading && selectedProduct && chartData.length === 0" class="no-data-state">
      <div class="empty-content">
        <span class="empty-icon">❌</span>
        <h3>No Price Data Found</h3>
        <p>The selected product "{{ selectedProduct }}" doesn't have multi-country pricing data.</p>
        <p>Try selecting a different product or fetch more data first.</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ProductChartTab',
  props: {
    databaseProducts: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      selectedProduct: '',
      chartType: 'bar',
      chartData: [],
      loading: false
    }
  },
  computed: {
    uniqueProducts() {
      // Get unique product names from database
      const products = [...new Set(this.databaseProducts.map(p => p.name))];
      return products.sort();
    },
    maxPrice() {
      if (this.chartData.length === 0) return 5;
      return Math.max(...this.chartData.map(d => d.price)) * 1.1;
    },
    highestPriceCountry() {
      if (this.chartData.length === 0) return { country: '', price: 0 };
      return this.chartData.reduce((max, item) => item.price > max.price ? item : max);
    },
    lowestPriceCountry() {
      if (this.chartData.length === 0) return { country: '', price: 0 };
      return this.chartData.reduce((min, item) => item.price < min.price ? item : min);
    },
    priceDifference() {
      if (this.chartData.length === 0) return 0;
      const max = Math.max(...this.chartData.map(d => d.price));
      const min = Math.min(...this.chartData.map(d => d.price));
      return (max - min).toFixed(2);
    },
    pricePercentageDifference() {
      if (this.chartData.length === 0) return 0;
      const max = Math.max(...this.chartData.map(d => d.price));
      const min = Math.min(...this.chartData.map(d => d.price));
      return (((max - min) / min) * 100).toFixed(1);
    },
    averagePrice() {
      if (this.chartData.length === 0) return 0;
      const total = this.chartData.reduce((sum, item) => sum + item.price, 0);
      return (total / this.chartData.length).toFixed(2);
    },
    croatianPrice() {
      const croatianData = this.chartData.find(d => d.country === 'Hrvatska');
      return croatianData ? croatianData.price : 0;
    },
    linePoints() {
      if (this.chartData.length === 0) return '';
      return this.chartData
        .map((point, index) => `${100 + index * 150},${250 - (point.price / this.maxPrice) * 200}`)
        .join(' ');
    }
  },
  methods: {
    async fetchProductPrices() {
      if (!this.selectedProduct) {
        this.chartData = [];
        return;
      }

      this.loading = true;
      try {
        // Filter database products for the selected product across countries
        const productData = this.databaseProducts.filter(p => p.name === this.selectedProduct);
        
        if (productData.length === 0) {
          this.chartData = [];
          return;
        }

        // Group by country and get latest price for each
        const countryData = {};
        productData.forEach(product => {
          if (!countryData[product.country] || 
              new Date(product.scrapedAt) > new Date(countryData[product.country].scrapedAt)) {
            countryData[product.country] = product;
          }
        });

        // Convert to chart data format
        this.chartData = Object.values(countryData).map(product => ({
          country: product.country,
          price: parseFloat(product.price),
          currency: product.currency,
          store: product.store,
          scrapedAt: product.scrapedAt
        })).sort((a, b) => a.country.localeCompare(b.country));

        console.log(`✅ Loaded price data for "${this.selectedProduct}" across ${this.chartData.length} countries`);

      } catch (error) {
        console.error('Error fetching product prices:', error);
        this.chartData = [];
      } finally {
        this.loading = false;
      }
    },

    getCountryFlag(country) {
      const flags = {
        'Hrvatska': '🇭🇷',
        'Germany': '🇩🇪',
        'Slovenia': '🇸🇮',
        'Austria': '🇦🇹'
      };
      return flags[country] || '🏳️';
    },

    getCountryColor(country) {
      const colors = {
        'Hrvatska': '#FF6B6B',
        'Germany': '#4ECDC4',
        'Slovenia': '#45B7D1',
        'Austria': '#96CEB4'
      };
      return colors[country] || '#888';
    },

    getPriceDifference(price1, price2) {
      if (price2 === 0) return '0';
      return (((price1 - price2) / price2) * 100).toFixed(1);
    }
  }
}
</script>

<style scoped>
.chart-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.info-box {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 1.5rem;
  border-left: 4px solid #4CAF50;
}

.info-box h4 {
  margin-bottom: 0.5rem;
  color: rgba(255, 255, 255, 0.9);
}

.info-box p {
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.4;
  margin: 0;
}

.chart-controls {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.control-section h3 {
  margin-bottom: 1rem;
  color: rgba(255, 255, 255, 0.9);
}

.product-selection {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.product-selector {
  flex: 1;
  min-width: 300px;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
  color: white;
  font-size: 1rem;
}

.product-selector option {
  background: #333;
  color: white;
}

.chart-type-buttons {
  display: flex;
  gap: 0.5rem;
}

.chart-type-btn {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.chart-type-btn.active {
  background: #4CAF50;
  transform: translateY(-2px);
}

.chart-type-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  margin: 2rem 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #90EE90;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.chart-section {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.chart-header {
  text-align: center;
  margin-bottom: 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 1rem;
}

.chart-header h3 {
  margin-bottom: 0.5rem;
  color: rgba(255, 255, 255, 0.9);
}

.simple-chart-container {
  margin: 2rem 0;
}

.chart-title {
  text-align: center;
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 2rem;
  color: rgba(255, 255, 255, 0.9);
}

.bar-chart {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 2rem;
}

.bars-container {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 300px;
  margin-top: 2rem;
}

.bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  max-width: 150px;
}

.country-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1rem;
  text-align: center;
}

.flag {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.country-name {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.8);
}

.bar-wrapper {
  width: 60px;
  height: 200px;
  display: flex;
  align-items: flex-end;
  position: relative;
}

.price-bar {
  width: 100%;
  min-height: 20px;
  border-radius: 4px 4px 0 0;
  position: relative;
  transition: all 0.3s ease;
  cursor: pointer;
}

.price-bar:hover {
  opacity: 0.8;
  transform: scaleY(1.05);
}

.price-label {
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.9rem;
  font-weight: bold;
  color: #90EE90;
  white-space: nowrap;
}

.line-chart {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 2rem;
}

.line-svg {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

.price-analysis {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 1.5rem;
  margin: 2rem 0;
}

.price-analysis h4 {
  margin-bottom: 1rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.9);
}

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.analysis-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.analysis-item .label {
  color: rgba(255, 255, 255, 0.8);
}

.analysis-item .value {
  font-weight: bold;
  color: #90EE90;
}

.analysis-item.highest .value {
  color: #ff6b6b;
}

.analysis-item.lowest .value {
  color: #51cf66;
}

.country-details {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 1.5rem;
  margin-top: 2rem;
}

.country-details h4 {
  margin-bottom: 1rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.9);
}

.country-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.country-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 1rem;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.country-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

.country-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 0.5rem;
}

.country-flag {
  font-size: 2rem;
  margin-bottom: 0.25rem;
}

.country-price {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.price-note {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
}

.empty-chart-state, .no-data-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.empty-content {
  text-align: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 3rem 2rem;
  max-width: 400px;
}

.empty-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 1rem;
}

.empty-content h3 {
  margin-bottom: 1rem;
  color: rgba(255, 255, 255, 0.9);
}

.empty-content p {
  margin-bottom: 1rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
}

.available-products {
  background: rgba(0, 0, 0, 0.2);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  color: #90EE90;
  font-weight: 500;
}

@media (max-width: 768px) {
  .product-selection {
    flex-direction: column;
    align-items: stretch;
  }
  
  .product-selector {
    min-width: auto;
  }
  
  .chart-type-buttons {
    justify-content: center;
  }
  
  .bars-container {
    flex-direction: column;
    height: auto;
    gap: 1rem;
  }
  
  .bar-item {
    flex-direction: row;
    max-width: none;
  }
  
  .bar-wrapper {
    width: 200px;
    height: 40px;
  }
  
  .analysis-grid {
    grid-template-columns: 1fr;
  }
  
  .country-cards {
    grid-template-columns: 1fr;
  }
}
</style>