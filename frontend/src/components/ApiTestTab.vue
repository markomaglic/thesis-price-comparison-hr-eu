<template>
  <div class="tab-content">
    <h2>🔧 API Testing & Statistics</h2>

    <div class="api-tests">
      <div class="api-section">
        <h3>📊 Data Endpoints</h3>
        <button @click="$emit('test-endpoint', '/api/products')" class="test-button">
          Test All Products API
        </button>
        <button @click="$emit('test-endpoint', '/api/products/database')" class="test-button">
          Test Database Products API
        </button>
        <button @click="$emit('test-endpoint', '/api/products/comparison')" class="test-button">
          Test Comparison API
        </button>
        <button @click="$emit('test-endpoint', '/api/stats')" class="test-button">
          Test Statistics API
        </button>
      </div>

      <div class="api-section">
        <h3>🛒 Real Lidl Scraping Endpoints</h3>
        <button @click="$emit('test-endpoint', '/api/test-free-apify')" class="test-button">
          Test Apify Connection
        </button>
        <button @click="$emit('test-endpoint', '/api/fetch/real/Germany')" class="test-button">
          Test Germany Scraping
        </button>
        <button @click="$emit('test-endpoint', '/api/fetch/real/Hrvatska')" class="test-button">
          Test Croatia Scraping
        </button>
        <button @click="$emit('test-endpoint', '/api/fetch/basic')" class="test-button">
          Test Basic Fetch API
        </button>
      </div>

      <div class="api-section">
        <h3>📈 Price History Endpoints</h3>
        <button @click="$emit('test-endpoint', '/api/price-history/status')" class="test-button">
          Test Price History Status
        </button>
        <button @click="$emit('test-endpoint', '/api/price-history/comparison')" class="test-button">
          Test Price Comparison API
        </button>
        <button @click="$emit('test-endpoint', '/api/prices/comparison-over-time')" class="test-button">
          Test Price Trends API
        </button>
        <button @click="$emit('test-endpoint', '/api/prices/trending')" class="test-button">
          Test Trending Products API
        </button>
      </div>

      <div class="api-section">
        <h3>🔧 System Endpoints</h3>
        <button @click="$emit('test-endpoint', '/health')" class="test-button">
          Test Health API
        </button>
        <button @click="$emit('test-endpoint', '/api/fetch/status')" class="test-button">
          Test Status API
        </button>
        <button @click="$emit('test-endpoint', '/api/categories')" class="test-button">
          Test Categories API
        </button>
        <button @click="$emit('test-endpoint', '/')" class="test-button">
          Test Root API Info
        </button>
      </div>
    </div>

    <div v-if="apiResponse" class="api-response">
      <h4>API Response:</h4>
      <div class="response-meta">
        <span class="status-badge" :class="getStatusClass(apiResponse.status)">
          Status: {{ apiResponse.status || 'Unknown' }}
        </span>
        <span class="endpoint-info">Endpoint: {{ apiResponse.endpoint }}</span>
        <span class="time-info">Time: {{ formatTime(new Date()) }}</span>
      </div>
      
      <div class="response-content">
        <div class="response-header">
          <h5>Response Data:</h5>
          <button @click="copyToClipboard" class="copy-button">
            📋 Copy Response
          </button>
        </div>
        <pre class="response-json">{{ JSON.stringify(apiResponse.data, null, 2) }}</pre>
      </div>
    </div>

    <div v-if="statistics" class="statistics-section">
      <h3>📈 Database Statistics</h3>
      
      <div class="stats-overview">
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-icon">📦</span>
            <div class="stat-content">
              <span class="stat-label">Total Products:</span>
              <span class="stat-value">{{ statistics.overall?.total_prices || 0 }}</span>
            </div>
          </div>
          <div class="stat-item">
            <span class="stat-icon">🎯</span>
            <div class="stat-content">
              <span class="stat-label">Unique Products:</span>
              <span class="stat-value">{{ statistics.overall?.unique_products || 0 }}</span>
            </div>
          </div>
          <div class="stat-item">
            <span class="stat-icon">💰</span>
            <div class="stat-content">
              <span class="stat-label">Average Price:</span>
              <span class="stat-value">{{ parseFloat(statistics.overall?.average_price || 0).toFixed(2) }} EUR</span>
            </div>
          </div>
          <div class="stat-item">
            <span class="stat-icon">🌍</span>
            <div class="stat-content">
              <span class="stat-label">Countries:</span>
              <span class="stat-value">{{ statistics.overall?.unique_stores || 0 }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="statistics.byCategory && statistics.byCategory.length > 0" class="category-stats">
        <h4>📂 Statistics by Category</h4>
        <div class="category-stats-grid">
          <div v-for="category in statistics.byCategory" :key="category.category" class="category-stat-card">
            <div class="category-header">
              <span class="category-name">{{ category.category }}</span>
              <span class="category-count">{{ category.product_count }} products</span>
            </div>
            <div class="category-price">
              <span class="price-label">Average Price:</span>
              <span class="price-value">€{{ parseFloat(category.avg_price).toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="statistics.byCountry && statistics.byCountry.length > 0" class="country-stats">
        <h4>🌍 Statistics by Country</h4>
        <div class="country-stats-grid">
          <div v-for="country in statistics.byCountry" :key="country.country" class="country-stat-card">
            <div class="country-header">
              <span class="country-flag">{{ getCountryFlag(country.country) }}</span>
              <span class="country-name">{{ country.country }}</span>
            </div>
            <div class="country-details">
              <div class="country-metric">
                <span class="metric-label">Products:</span>
                <span class="metric-value">{{ country.product_count }}</span>
              </div>
              <div class="country-metric">
                <span class="metric-label">Avg Price:</span>
                <span class="metric-value">€{{ parseFloat(country.avg_price).toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- API Documentation -->
    <div class="api-documentation">
      <h3>📚 API Documentation</h3>
      <div class="doc-sections">
        <div class="doc-section">
          <h4>🛒 Lidl Scraping Endpoints</h4>
          <div class="endpoint-list">
            <div class="endpoint-item">
              <span class="method get">GET</span>
              <span class="endpoint-path">/api/test-free-apify</span>
              <span class="endpoint-desc">Test Apify connection and token</span>
            </div>
            <div class="endpoint-item">
              <span class="method get">GET</span>
              <span class="endpoint-path">/api/fetch/real/:country</span>
              <span class="endpoint-desc">Scrape real Lidl data by country</span>
            </div>
            <div class="endpoint-item">
              <span class="method get">GET</span>
              <span class="endpoint-path">/api/fetch/basic</span>
              <span class="endpoint-desc">Scrape basic Lidl products</span>
            </div>
          </div>
        </div>

        <div class="doc-section">
          <h4>🔍 Search Endpoints</h4>
          <div class="endpoint-list">
            <div class="endpoint-item">
              <span class="method get">GET</span>
              <span class="endpoint-path">/api/search/database/:query</span>
              <span class="endpoint-desc">Search products by name/brand</span>
            </div>
            <div class="endpoint-item">
              <span class="method get">GET</span>
              <span class="endpoint-path">/api/search/category/:category</span>
              <span class="endpoint-desc">Search by product category</span>
            </div>
          </div>
        </div>

        <div class="doc-section">
          <h4>📈 Price History Endpoints</h4>
          <div class="endpoint-list">
            <div class="endpoint-item">
              <span class="method post">POST</span>
              <span class="endpoint-path">/api/price-history/initialize</span>
              <span class="endpoint-desc">Initialize price tracking</span>
            </div>
            <div class="endpoint-item">
              <span class="method get">GET</span>
              <span class="endpoint-path">/api/price-history/comparison</span>
              <span class="endpoint-desc">Monthly price comparison</span>
            </div>
            <div class="endpoint-item">
              <span class="method post">POST</span>
              <span class="endpoint-path">/api/prices/generate-history</span>
              <span class="endpoint-desc">Generate historical data</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ApiTestTab',
  props: {
    apiResponse: Object,
    statistics: Object
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
    getStatusClass(status) {
      if (status >= 200 && status < 300) return 'success';
      if (status >= 400 && status < 500) return 'client-error';
      if (status >= 500) return 'server-error';
      return 'unknown';
    },
    formatTime(date) {
      return date.toLocaleTimeString('hr-HR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    },
    copyToClipboard() {
      const text = JSON.stringify(this.apiResponse.data, null, 2);
      navigator.clipboard.writeText(text).then(() => {
        alert('✅ Response copied to clipboard!');
      }).catch(() => {
        alert('❌ Failed to copy to clipboard');
      });
    }
  }
}
</script>

<style scoped>
.api-tests {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.api-section {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 1.5rem;
}

.api-section h3 {
  margin-bottom: 1rem;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
}

.test-button {
  display: block;
  width: 100%;
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.test-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.test-button:last-child {
  margin-bottom: 0;
}

.api-response {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.api-response h4 {
  margin-bottom: 1rem;
  color: rgba(255, 255, 255, 0.9);
}

.response-meta {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.9rem;
  font-weight: bold;
}

.status-badge.success {
  background: rgba(81, 207, 102, 0.2);
  color: #51cf66;
}

.status-badge.client-error {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
}

.status-badge.server-error {
  background: rgba(255, 107, 107, 0.3);
  color: #ff5252;
}

.status-badge.unknown {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
}

.endpoint-info, .time-info {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
}

.response-content {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  overflow: hidden;
}

.response-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.response-header h5 {
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
}

.copy-button {
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid #4CAF50;
  color: #4CAF50;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.copy-button:hover {
  background: rgba(76, 175, 80, 0.3);
  transform: translateY(-1px);
}

.response-json {
  margin: 0;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.4);
  color: #90EE90;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 400px;
  overflow-y: auto;
  border: none;
}

.statistics-section {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.statistics-section h3 {
  margin-bottom: 1.5rem;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
}

.stats-overview {
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-item {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.3s ease;
}

.stat-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

.stat-icon {
  font-size: 2rem;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
}

.stat-value {
  font-weight: bold;
  color: #90EE90;
  font-size: 1.2rem;
}

.category-stats, .country-stats {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.category-stats h4, .country-stats h4 {
  margin-bottom: 1rem;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
}

.category-stats-grid, .country-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.category-stat-card, .country-stat-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.category-stat-card:hover, .country-stat-card:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.category-header, .country-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.category-name, .country-name {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.category-count {
  background: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
  padding: 0.25rem 0.5rem;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: bold;
}

.country-flag {
  font-size: 1.5rem;
  margin-right: 0.5rem;
}

.category-price, .country-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.country-details {
  flex-direction: column;
  gap: 0.5rem;
}

.country-metric {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.price-label, .metric-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}

.price-value, .metric-value {
  color: #FFD700;
  font-weight: bold;
}

.api-documentation {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 2rem;
}

.api-documentation h3 {
  margin-bottom: 1.5rem;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
}

.doc-sections {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.doc-section {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 1.5rem;
}

.doc-section h4 {
  margin-bottom: 1rem;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
}

.endpoint-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.endpoint-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  font-size: 0.9rem;
}

.method {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: bold;
  min-width: 45px;
  text-align: center;
}

.method.get {
  background: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
}

.method.post {
  background: rgba(33, 150, 243, 0.2);
  color: #2196F3;
}

.endpoint-path {
  font-family: 'Courier New', monospace;
  color: #90EE90;
  font-weight: 500;
  min-width: 200px;
}

.endpoint-desc {
  color: rgba(255, 255, 255, 0.7);
  flex: 1;
}

@media (max-width: 768px) {
  .api-tests {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .category-stats-grid, .country-stats-grid {
    grid-template-columns: 1fr;
  }
  
  .doc-sections {
    grid-template-columns: 1fr;
  }
  
  .response-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .endpoint-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .endpoint-path {
    min-width: auto;
  }
}
</style>