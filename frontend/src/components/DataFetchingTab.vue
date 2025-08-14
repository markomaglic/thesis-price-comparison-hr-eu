<template>
  <div class="tab-content">
    <h2>🎯 Open Food Facts Data Fetching</h2>

    <!-- Info cards (cleaner) -->
    <div class="info-grid">
      <div class="info-card">
        <div class="info-icon">🎯</div>
        <div class="info-body">
          <h4 class="info-title">Basic Products</h4>
          <p class="info-sub">Mlijeko, kruh, sir, jogurt, meso — osnovne HR namirnice</p>
        </div>
      </div>

      <div class="info-card">
        <div class="info-icon">🛒</div>
        <div class="info-body">
          <h4 class="info-title">Everyday Essentials</h4>
          <p class="info-sub">30 proizvoda + automatska EU usporedba cijena</p>
        </div>
      </div>

      <div class="info-card">
        <div class="info-icon">📊</div>
        <div class="info-body">
          <h4 class="info-title">Real Data Source</h4>
          <p class="info-sub">Open Food Facts API (800k+). Cijene simulirane za istraživanje.</p>
        </div>
      </div>
    </div>

    <!-- Actions (cleaner) -->
    <div class="fetching-actions cleaned-actions">
      <button
        @click="$emit('fetch-basic')"
        :disabled="fetchingStatus === 'loading'"
        class="btn btn-primary"
      >
        <span class="button-icon">🎯</span>
        <span class="btn-line">Fetch Basic Products</span>
        <small class="btn-sub">mlijeko, kruh, sir, jogurt, meso</small>
      </button>

      <button
        @click="$emit('fetch-everyday')"
        :disabled="fetchingStatus === 'loading'"
        class="btn btn-primary"
      >
        <span class="button-icon">🛒</span>
        <span class="btn-line">Fetch Everyday Essentials</span>
        <small class="btn-sub">30 products + EU comparisons</small>
      </button>

      <button @click="$emit('load-database')" class="btn btn-secondary">
        <span class="button-icon">📦</span>
        <span class="btn-line">Load Database Products</span>
      </button>

      <button @click="$emit('test-api')" class="btn btn-secondary">
        <span class="button-icon">🧪</span>
        <span class="btn-line">Test Open Food Facts API</span>
      </button>
    </div>

    <!-- Search -->
    <div class="search-section">
      <h3>🔍 Search Scraped Products</h3>

      <div class="search-info">
        <p>🎯 <strong>Database Search</strong> – pretraga već scrapanih proizvoda (bez novog scrapinga)</p>
      </div>

      <div class="search-controls">
        <input
          :value="searchQuery"
          @input="$emit('update:search-query', $event.target.value)"
          @keyup.enter="$emit('search-products')"
          placeholder="Search by name, brand, or category (npr. sir, Vindija, mlijeko...)"
          class="search-input"
        >
        <button
          @click="$emit('search-products')"
          :disabled="!searchQuery || searchQuery.length < 2"
          class="search-button"
        >
          <span class="button-icon">🔍</span>
          Search Database
        </button>
      </div>

      <div class="search-examples">
        <span>Quick searches:</span>
        <button
          v-for="example in searchExamples"
          :key="example"
          @click="$emit('quick-search', example)"
          class="example-button"
        >
          {{ example }}
        </button>
      </div>

      <!-- Category Search -->
      <div v-if="availableCategories && availableCategories.length > 0" class="category-search">
        <h4>📂 Search by Category</h4>
        <div class="category-buttons">
          <button
            v-for="category in availableCategories"
            :key="category.name"
            @click="$emit('search-by-category', category.name)"
            class="category-search-button"
          >
            {{ category.name }} ({{ category.product_count }})
          </button>
        </div>
      </div>

      <!-- Search Stats -->
      <div v-if="databaseProducts.length > 0" class="search-stats">
        <span class="stats-label">Database contains:</span>
        <span class="stats-value">{{ databaseProducts.length }} products</span>
        <span class="stats-label">across</span>
        <span class="stats-value">{{ Object.keys(categoryBreakdown).length }} categories</span>
        <span class="stats-label">in</span>
        <span class="stats-value">{{ countries.length }} countries</span>
      </div>
    </div>

    <div v-if="fetchingStatus === 'loading'" class="fetching-progress">
      <div class="spinner"></div>
      <p>Fetching real product data from Open Food Facts API...</p>
      <small>This may take a few moments</small>
    </div>

    <!-- Database Products Results -->
    <div v-if="databaseProducts.length > 0" class="fetched-results">
      <h3>📊 Stored Products ({{ databaseProducts.length }})</h3>
      <div class="results-info">
        <div class="data-source-info">
          <span class="source-label">Data Source:</span>
          <span class="source-value database">📊 Open Food Facts + PostgreSQL</span>
        </div>
        <div class="currency-info">
          <span class="currency-label">Currency:</span>
          <span class="currency-value">EUR (All Countries)</span>
        </div>
      </div>

      <div class="products-grid">
        <div
          v-for="product in databaseProducts"
          :key="`${product.name}-${product.country}-${product.scrapedAt}`"
          class="product-card"
        >
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
            <div class="country-info">
              <span class="country-flag">{{ getCountryFlag(product.country) }}</span>
              <span class="country">{{ product.country }}</span>
              <span class="store">{{ product.store }}</span>
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
        <div
          v-for="product in searchResults"
          :key="`search-${product.name}-${product.country}`"
          class="product-card search-result"
        >
          <div class="product-header">
            <h4>{{ product.name }}</h4>
            <span class="category-badge">{{ product.category }}</span>
          </div>
          <div class="product-price">
            <span class="price">{{ product.price }} {{ product.currency }}</span>
            <span v-if="product.unit" class="unit">{{ product.unit }}</span>
          </div>
          <div class="product-meta">
            <div class="country-info">
              <span class="country-flag">{{ getCountryFlag(product.country) }}</span>
              <span class="country">{{ product.country }}</span>
            </div>
            <span class="store">{{ product.store }}</span>
          </div>
          <div v-if="product.note" class="product-note">
            <small>{{ product.note }}</small>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DataFetchingTab',
  props: {
    fetchingStatus: String,
    databaseProducts: Array,
    searchResults: Array,
    searchQuery: String,
    lastSearchQuery: String,
    availableCategories: Array,
    searchExamples: Array
  },
  computed: {
    categoryBreakdown() {
      const breakdown = {};
      this.databaseProducts.forEach(product => {
        breakdown[product.category] = (breakdown[product.category] || 0) + 1;
      });
      return breakdown;
    },
    countries() {
      return ['Hrvatska', 'Germany', 'Slovenia', 'Austria'];
    }
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
    formatDateTime(dateString) {
      if (!dateString) return 'Unknown';
      return new Date(dateString).toLocaleString('hr-HR');
    }
  }
}
</script>

<style scoped>
/* Info cards */
.info-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 12px 0 16px;
}
@media (max-width: 1024px) {
  .info-grid { grid-template-columns: 1fr; }
}
.info-card {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 10px;
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(6px);
}
.info-icon {
  font-size: 22px;
  line-height: 1;
  width: 28px;
  text-align: center;
}
.info-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}
.info-sub {
  margin: 2px 0 0;
  font-size: 13px;
  color: #cbd5e1;
}

/* Actions */
.cleaned-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 8px 0 20px;
}
@media (max-width: 640px) {
  .cleaned-actions { grid-template-columns: 1fr; }
}
.btn {
  display: grid;
  grid-template-columns: 22px 1fr;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(6px);
  color: #fff;
  transition: background 0.2s ease;
}
.btn .button-icon { font-size: 18px; line-height: 1; }
.btn .btn-line { font-weight: 600; font-size: 14px; }
.btn .btn-sub { display: block; font-size: 12px; color: #cbd5e1; margin-top: 2px; }
.btn-primary:hover { background: rgba(255,255,255,0.1); }
.btn-primary[disabled] { opacity: 0.6; cursor: not-allowed; }
.btn-secondary {
  background: transparent;
}
.btn-secondary:hover { background: rgba(255,255,255,0.08); }

/* Search section */
.search-section h3 { margin-top: 8px; color: #fff; }
.search-info { margin: 6px 0 10px; color: #cbd5e1; }
.search-controls {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  margin-bottom: 8px;
}
.search-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  background: rgba(255,255,255,0.05);
  color: #fff;
}
.search-input::placeholder { color: #94a3b8; }
.search-button {
  padding: 10px 14px;
  border: 1px solid rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.05);
  color: #fff;
  border-radius: 8px;
}
.search-button:hover { background: rgba(255,255,255,0.1); }
.search-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-bottom: 10px;
  color: #cbd5e1;
}
.example-button {
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.05);
  padding: 6px 10px;
  border-radius: 999px;
  color: #fff;
}

/* Category buttons */
.category-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.category-search-button {
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.05);
  padding: 6px 10px;
  border-radius: 8px;
  color: #fff;
}

/* Stats row */
.search-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  background: rgba(255,255,255,0.05);
  margin-top: 10px;
  color: #fff;
}
.stats-label { color: #cbd5e1; font-size: 13px; }
.stats-value { font-weight: 600; font-size: 13px; color: #22c55e; }

/* Spinner */
.fetching-progress { text-align: center; padding: 16px 0; color: #fff; }
.spinner {
  width: 26px; height: 26px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #22c55e;
  border-radius: 50%; margin: 0 auto 8px; animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Product cards */
.products-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 1024px) { .products-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .products-grid { grid-template-columns: 1fr; } }
.product-card {
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 10px;
  padding: 12px;
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(6px);
  color: #fff;
}
.product-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: baseline;
}
.category-badge {
  border: 1px solid rgba(255,255,255,0.2);
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  color: #cbd5e1;
}
.product-price { margin: 6px 0; display: flex; gap: 8px; align-items: baseline; }
.price { color: #22c55e; }
.original-price { text-decoration: line-through; color: #94a3b8; font-size: 12px; }
.unit { color: #cbd5e1; font-size: 12px; }
.product-meta {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  margin-top: 6px;
}
.country-info { display: flex; gap: 6px; align-items: center; color: #cbd5e1; }
.availability { font-size: 13px; }
.availability.available { color: #22c55e; }
.scraped-time { margin-top: 6px; color: #94a3b8; font-size: 12px; }
</style>

