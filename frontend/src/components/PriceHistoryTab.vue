<template>
  <div class="tab-content">
    <h2>📈 Price History & Trends</h2>

    <div class="price-history-controls">
      <div class="control-section">
        <h3>📊 Historical Data Setup</h3>
        <p>Generate historical price data to analyze trends over time</p>

        <div class="history-actions">
          <button @click="$emit('generate-historical')" :disabled="loadingHistory" class="history-button generate">
            <span class="button-icon">🗃️</span>
            {{ loadingHistory ? 'Generating...' : 'Generate Historical Data' }}
            <small>Create 12 months of price history</small>
          </button>

          <button @click="$emit('load-price-comparison')" class="history-button secondary">
            <span class="button-icon">📊</span>
            Load Price Trends
            <small>Get comparison charts</small>
          </button>

          <button @click="$emit('simulate-price-update')" class="history-button secondary">
            <span class="button-icon">🔄</span>
            Simulate Price Update
            <small>Add new price points</small>
          </button>
        </div>
      </div>

      <div class="control-section">
        <h3>🔍 Product Price History</h3>
        <div class="product-search">
          <input 
            :value="priceHistoryQuery" 
            @input="$emit('update:price-history-query', $event.target.value)"
            @keyup.enter="$emit('load-product-history')"
            placeholder="Search product price history (e.g., Vindija Mlijeko)" 
            class="history-search-input"
          >
          <select :value="selectedCountryFilter" @change="$emit('update:selected-country-filter', $event.target.value)" class="country-filter">
            <option value="">All Countries</option>
            <option value="Hrvatska">🇭🇷 Hrvatska</option>
            <option value="Germany">🇩🇪 Germany</option>
            <option value="Slovenia">🇸🇮 Slovenia</option>
            <option value="Austria">🇦🇹 Austria</option>
          </select>
          <button @click="$emit('load-product-history')" :disabled="!priceHistoryQuery" class="search-history-button">
            <span class="button-icon">📈</span>
            Get History
          </button>
        </div>
      </div>
    </div>

    <!-- Price Comparison Chart -->
    <div v-if="priceComparisonData.length > 0" class="price-comparison-chart">
      <h3>📊 Average Prices Over Time</h3>
      <div class="chart-container">
        <div class="chart-header">
          <div class="chart-legend">
            <div class="legend-item">
              <span class="legend-color croatia"></span>
              <span>🇭🇷 Hrvatska</span>
            </div>
            <div class="legend-item">
              <span class="legend-color germany"></span>
              <span>🇩🇪 Germany</span>
            </div>
            <div class="legend-item">
              <span class="legend-color slovenia"></span>
              <span>🇸🇮 Slovenia</span>
            </div>
            <div class="legend-item">
              <span class="legend-color austria"></span>
              <span>🇦🇹 Austria</span>
            </div>
          </div>
        </div>

        <!-- Simple ASCII-style chart for demo -->
        <div class="simple-chart">
          <div class="chart-y-axis">
            <span>€{{ maxPrice.toFixed(2) }}</span>
            <span>€{{ (maxPrice * 0.75).toFixed(2) }}</span>
            <span>€{{ (maxPrice * 0.5).toFixed(2) }}</span>
            <span>€{{ (maxPrice * 0.25).toFixed(2) }}</span>
            <span>€0.00</span>
          </div>

          <div class="chart-area">
            <div v-for="dataPoint in priceComparisonData" :key="dataPoint.month" class="chart-month">
              <div class="month-label">{{ formatMonth(dataPoint.month) }}</div>
              <div class="price-bars">
                <div v-for="(countryData, country) in dataPoint.countries" :key="country" class="price-bar"
                  :class="country.toLowerCase()"
                  :style="{ height: `${(parseFloat(countryData.avgPrice) / maxPrice) * 100}%` }"
                  :title="`${country}: €${countryData.avgPrice}`">
                  <span class="price-value">€{{ countryData.avgPrice }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Product Price History -->
    <div v-if="productPriceHistory.length > 0" class="product-history-section">
      <h3>📈 Price History: {{ lastHistoryQuery }}</h3>
      <div class="product-history-chart">
        <div class="history-summary">
          <div class="summary-stat">
            <span class="stat-label">Data Points:</span>
            <span class="stat-value">{{ productPriceHistory.length }}</span>
          </div>
          <div class="summary-stat">
            <span class="stat-label">Price Range:</span>
            <span class="stat-value">€{{ minProductPrice }} - €{{ maxProductPrice }}</span>
          </div>
          <div class="summary-stat">
            <span class="stat-label">Average:</span>
            <span class="stat-value">€{{ averageProductPrice }}</span>
          </div>
        </div>

        <div class="history-timeline">
          <div v-for="entry in productPriceHistory" :key="`${entry.country}-${entry.date}`" class="timeline-entry">
            <div class="timeline-date">{{ formatDate(entry.date) }}</div>
            <div class="timeline-price" :class="entry.country.toLowerCase()">
              <span class="country-flag">{{ getCountryFlag(entry.country) }}</span>
              <span class="price">€{{ entry.price.toFixed(2) }}</span>
              <span class="country">{{ entry.country }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Trending Products -->
    <div v-if="trendingProducts.length > 0" class="trending-section">
      <h3>🔥 Trending Products (Biggest Price Changes)</h3>
      <div class="trending-grid">
        <div v-for="product in trendingProducts" :key="`${product.productName}-${product.country}`"
          class="trending-card">
          <div class="trending-header">
            <h4>{{ product.productName }}</h4>
            <span class="country-badge">{{ getCountryFlag(product.country) }} {{ product.country }}</span>
          </div>
          <div class="trending-data">
            <div class="price-change">
              <span class="old-price">€{{ product.firstPrice.toFixed(2) }}</span>
              <span class="arrow">→</span>
              <span class="new-price">€{{ product.latestPrice.toFixed(2) }}</span>
            </div>
            <div class="change-percent" :class="{
              positive: product.priceChangePercent > 0,
              negative: product.priceChangePercent < 0
            }">
              {{ product.priceChangePercent > 0 ? '+' : '' }}{{ product.priceChangePercent }}%
            </div>
          </div>
          <div class="trending-meta">
            <span class="data-points">{{ product.pricePoints }} data points</span>
            <span class="trend-icon">{{ product.trend === 'increasing' ? '📈' : '📉' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!priceComparisonData.length && !productPriceHistory.length && !loadingHistory"
      class="empty-history-state">
      <div class="empty-content">
        <span class="empty-icon">📈</span>
        <h3>No Price History Data</h3>
        <p>Generate historical price data to see trends and charts over time.</p>
        <button @click="$emit('generate-historical')" class="generate-data-btn">
          <span class="button-icon">🗃️</span>
          Generate Historical Data
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PriceHistoryTab',
  props: {
    priceComparisonData: Array,
    productPriceHistory: Array,
    trendingProducts: Array,
    loadingHistory: Boolean,
    priceHistoryQuery: String,
    lastHistoryQuery: String,
    selectedCountryFilter: String,
    maxPrice: Number,
    minProductPrice: String,
    maxProductPrice: String,
    averageProductPrice: String
  },
  methods: {
    getCountryFlag(country) {
      const flags = {
        'Hrvatska': '🇭🇷',
        'Germany': '🇩🇪',
        'Slovenia': '🇸🇮',
        'Austria': '🇦🇹'
      };
      return flags[country] || '🏳️';
    },
    formatMonth(monthString) {
      const date = new Date(monthString + '-01');
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    },
    formatDate(dateString) {
      if (!dateString) return 'Never';
      return new Date(dateString).toLocaleDateString('hr-HR');
    }
  }
}
</script>

<style scoped>
/* Price History Styles */
.price-history-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
}

.control-section {
  background: rgba(255,255,255,0.1);
  border-radius: 15px;
  padding: 1.5rem;
}

.control-section h3 {
  margin-bottom: 0.5rem;
  color: rgba(255,255,255,0.9);
}

.control-section p {
  margin-bottom: 1.5rem;
  color: rgba(255,255,255,0.7);
  font-size: 0.9rem;
}

.history-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.history-button {
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
  min-height: 80px;
  justify-content: center;
}

.history-button.generate {
  background: linear-gradient(45deg, #FF6B35, #F7931E);
}

.history-button.secondary {
  background: rgba(255,255,255,0.2);
}

.history-button:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.3);
}

.history-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.history-button small {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  opacity: 0.8;
}

.product-search {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.history-search-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  background: rgba(0,0,0,0.2);
  color: white;
  font-size: 0.9rem;
}

.history-search-input::placeholder {
  color: rgba(255,255,255,0.5);
}

.country-filter {
  padding: 0.75rem;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  background: rgba(0,0,0,0.2);
  color: white;
  font-size: 0.9rem;
}

.country-filter option {
  background: #333;
  color: white;
}

.search-history-button {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  background: linear-gradient(45deg, #4CAF50, #45a049);
  color: white;
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.price-comparison-chart {
  background: rgba(255,255,255,0.1);
  border-radius: 15px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.chart-container {
  margin-top: 1rem;
}

.chart-legend {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 3px;
}

.legend-color.croatia { background: #FF6B6B; }
.legend-color.germany { background: #4ECDC4; }
.legend-color.slovenia { background: #45B7D1; }
.legend-color.austria { background: #96CEB4; }

.simple-chart {
  display: flex;
  height: 300px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  background: rgba(0,0,0,0.2);
}

.chart-y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1rem 0.5rem;
  border-right: 1px solid rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.7);
  font-size: 0.8rem;
  width: 60px;
}

.chart-area {
  flex: 1;
  display: flex;
  align-items: flex-end;
  padding: 1rem;
  gap: 0.5rem;
}

.chart-month {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.month-label {
  color: rgba(255,255,255,0.7);
  font-size: 0.7rem;
  margin-bottom: 0.5rem;
  transform: rotate(-45deg);
  white-space: nowrap;
}

.price-bars {
  display: flex;
  gap: 2px;
  align-items: flex-end;
  height: 220px;
  width: 100%;
  justify-content: center;
}

.price-bar {
  width: 8px;
  min-height: 4px;
  border-radius: 2px 2px 0 0;
  position: relative;
  transition: all 0.3s ease;
}

.price-bar.hrvatska { background: #FF6B6B; }
.price-bar.germany { background: #4ECDC4; }
.price-bar.slovenia { background: #45B7D1; }
.price-bar.austria { background: #96CEB4; }

.price-bar:hover {
  opacity: 0.8;
  transform: scaleX(1.5);
}

.price-value {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.6rem;
  color: white;
  background: rgba(0,0,0,0.8);
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.price-bar:hover .price-value {
  opacity: 1;
}

.product-history-section {
  background: rgba(255,255,255,0.1);
  border-radius: 15px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.history-summary {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.summary-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.summary-stat .stat-label {
  color: rgba(255,255,255,0.7);
  font-size: 0.9rem;
}

.summary-stat .stat-value {
  color: #90EE90;
  font-weight: bold;
  font-size: 1.1rem;
}

.history-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
}

.timeline-entry {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
}

.timeline-date {
  color: rgba(255,255,255,0.7);
  font-size: 0.9rem;
  min-width: 100px;
}

.timeline-price {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.timeline-price .price {
  font-weight: bold;
  color: #90EE90;
  font-size: 1.1rem;
}

.timeline-price .country {
  color: rgba(255,255,255,0.8);
  font-size: 0.9rem;
}

.trending-section {
  background: rgba(255,255,255,0.1);
  border-radius: 15px;
  padding: 2rem;
}

.trending-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

.trending-card {
  background: rgba(0,0,0,0.2);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid rgba(255,255,255,0.1);
}

.trending-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.trending-header h4 {
  margin: 0;
  font-size: 1rem;
  color: rgba(255,255,255,0.9);
  flex: 1;
}

.country-badge {
  background: rgba(255,255,255,0.2);
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  white-space: nowrap;
}

.trending-data {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.price-change {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.old-price {
  color: rgba(255,255,255,0.6);
  text-decoration: line-through;
}

.arrow {
  color: rgba(255,255,255,0.7);
}

.new-price {
  color: #90EE90;
  font-weight: bold;
}

.change-percent {
  font-weight: bold;
  font-size: 1.1rem;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
}

.change-percent.positive {
  background: rgba(255,107,107,0.2);
  color: #ff6b6b;
}

.change-percent.negative {
  background: rgba(81,207,102,0.2);
  color: #51cf66;
}

.trending-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: rgba(255,255,255,0.6);
}

.trend-icon {
  font-size: 1.2rem;
}

.empty-history-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.empty-content {
  text-align: center;
  background: rgba(255,255,255,0.1);
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
  color: rgba(255,255,255,0.9);
}

.empty-content p {
  margin-bottom: 2rem;
  color: rgba(255,255,255,0.7);
  line-height: 1.5;
}

.generate-data-btn {
  background: linear-gradient(45deg, #FF6B35, #F7931E);
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.generate-data-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}

@media (max-width: 768px) {
  .price-history-controls {
    grid-template-columns: 1fr;
  }
  
  .product-search {
    flex-direction: column;
  }
  
  .chart-legend {
    justify-content: flex-start;
  }
  
  .trending-grid {
    grid-template-columns: 1fr;
  }
  
  .history-summary {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>