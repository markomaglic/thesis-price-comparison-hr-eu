<template>
  <div class="tab-content">
    <h2>🔧 API Testing & Statistics</h2>

    <div class="api-tests">
      <div class="api-section">
        <h3>📊 Product Data Endpoints</h3>
        <button @click="$emit('test-endpoint', '/api/products/hr')" class="test-button">
          Test Croatia Products
        </button>
        <button @click="$emit('test-endpoint', '/api/products/de')" class="test-button">
          Test Germany Products
        </button>
        <button @click="$emit('test-endpoint', '/api/products/si')" class="test-button">
          Test Slovenia Products
        </button>
        <button @click="$emit('test-endpoint', '/api/products/at')" class="test-button">
          Test Austria Products
        </button>
        <button @click="$emit('test-endpoint', '/api/compare')" class="test-button">
          Test Price Comparison
        </button>
      </div>

      <div class="api-section">
        <h3>🛒 Scraping Endpoints</h3>
        <button @click="testScrapeEndpoint('hr')" class="test-button">
          Test Scrape Croatia
        </button>
        <button @click="testScrapeEndpoint('de')" class="test-button">
          Test Scrape Germany
        </button>
        <button @click="testScrapeEndpoint('si')" class="test-button">
          Test Scrape Slovenia
        </button>
        <button @click="testScrapeEndpoint('at')" class="test-button">
          Test Scrape Austria
        </button>
      </div>

      <div class="api-section">
        <h3>📈 Price History Endpoints</h3>
        <button @click="testHistoryGeneration()" class="test-button">
          Generate Historical Data
        </button>
        <button @click="$emit('test-endpoint', '/api/prices/history/milk?country=Germany&monthsBack=6')"
          class="test-button">
          Test Price History (Milk)
        </button>
        <button @click="$emit('test-endpoint', '/api/history?name=bread&monthsBack=12')" class="test-button">
          Test History Query
        </button>
        <button @click="$emit('test-endpoint', '/api/overview?monthsBack=6')" class="test-button">
          Test Monthly Averages
        </button>
        <button @click="regenerateComparisonKeys()" class="test-button">
          Regenerate Comparison Keys
        </button>
        <button @click="$emit('test-endpoint', '/api/debug/normalization/slovenia')" class="test-button">
          Debug Normalization (Croatia)
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
    async testScrapeEndpoint(country) {
      try {
        const response = await fetch(`http://localhost:3001/api/scrape/${country}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ limit: 10 }) // Small limit for testing
        });

        const data = await response.json();
        this.$emit('api-response', {
          status: response.status,
          data: data,
          endpoint: `/api/scrape/${country}`,
          method: 'POST'
        });
      } catch (error) {
        this.$emit('api-response', {
          error: error.message,
          endpoint: `/api/scrape/${country}`,
          status: 'Error',
          method: 'POST'
        });
      }
    },

    async testHistoryGeneration() {
      try {
        const response = await fetch('http://localhost:3001/api/prices/generate-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ monthsBack: 6 }) // Generate 6 months for testing
        });

        const data = await response.json();
        this.$emit('api-response', {
          status: response.status,
          data: data,
          endpoint: '/api/prices/generate-history',
          method: 'POST'
        });
      } catch (error) {
        this.$emit('api-response', {
          error: error.message,
          endpoint: '/api/prices/generate-history',
          status: 'Error',
          method: 'POST'
        });
      }
    },

    async regenerateComparisonKeys() {
      try {
        const response = await fetch('http://localhost:3001/api/regenerate-keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        const data = await response.json();
        this.$emit('api-response', {
          status: response.status,
          data: data,
          endpoint: '/api/regenerate-keys',
          method: 'POST'
        });
      } catch (error) {
        this.$emit('api-response', {
          error: error.message,
          endpoint: '/api/regenerate-keys',
          status: 'Error',
          method: 'POST'
        });
      }
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

.endpoint-note {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 5px;
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

.endpoint-info,
.time-info {
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