<template>
  <div class="tab-content">
    <h2>📊 Price Comparison Analysis</h2>

    <div v-if="comparisonData.length > 0" class="comparison-section">
      <div class="comparison-stats">
        <div class="comparison-stat">
          <h4>Products Compared</h4>
          <span class="stat-value">{{ comparisonData.length }}</span>
        </div>
      </div>

      <button @click="$emit('load-comparison')" class="load-comparison-btn">
        <span class="button-icon">🔄</span>
        Refresh Comparison Data
      </button>

      <div class="comparison-grid">
        <div v-for="comparison in comparisonData" :key="comparison.name" class="comparison-card">
          <div class="comparison-header">
            <h4>{{ comparison.name }}</h4>
            <span class="category-badge">{{ comparison.category }}</span>
          </div>

          <div class="countries-comparison">
            <div v-for="(data, country) in comparison.countries" :key="country" class="country-price">
              <div class="country-header">
                <span class="country-flag">{{ getCountryFlag(country) }}</span>
                <span class="country-name">{{ country }}</span>
              </div>
              <div class="price-info">
                <span class="price">{{ data.price }} {{ data.currency }}</span>
                <span class="store">{{ data.store }}</span>
              </div>
            </div>
          </div>

          <div v-if="comparison.countries['Hrvatska'] && comparison.countries['Germany']" class="price-difference">
            <span class="difference-label">HR vs DE:</span>
            <span class="difference-value" :class="{
              positive: comparison.countries['Hrvatska'].price > comparison.countries['Germany'].price,
              negative: comparison.countries['Hrvatska'].price < comparison.countries['Germany'].price
            }">
              {{ getPriceDifference(comparison.countries['Hrvatska'].price, comparison.countries['Germany'].price) }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="no-comparison-data">
      <div class="empty-state">
        <span class="empty-icon">📊</span>
        <h3>No Comparison Data Available</h3>
        <p>Fetch some products first to see price comparisons between Croatia and EU countries.</p>
        <button @click="$emit('go-to-fetching')" class="fetch-data-btn">
          Go to Data Fetching
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PriceComparisonTab',
  props: {
    comparisonData: Array,
    averagePriceCroatia: String,
    averagePriceEU: String,
    priceDifference: [String, Number]
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
    getPriceDifference(price1, price2) {
      if (price2 === 0) return '0';
      return (((price1 - price2) / price2) * 100).toFixed(1);
    }
  }
}
</script>

<style scoped>
.comparison-section {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.comparison-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.comparison-stat {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 1.5rem;
  text-align: center;
}

.comparison-stat h4 {
  margin-bottom: 0.5rem;
  color: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
}

.comparison-stat .stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #90EE90;
  display: block;
}

.comparison-stat .stat-value.positive {
  color: #ff6b6b;
}

.comparison-stat .stat-value.negative {
  color: #51cf66;
}

.load-comparison-btn {
  background: linear-gradient(45deg, #0faf01, #129601);
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
}

.load-comparison-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 1.5rem;
}

.comparison-card {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 15px;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.comparison-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  background: rgba(255, 255, 255, 0.15);
}

.comparison-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 1rem;
}

.comparison-header h4 {
  margin: 0;
  font-size: 1.1rem;
  flex: 1;
  color: rgba(255, 255, 255, 0.95);
}

.category-badge {
  background: rgba(76, 175, 80, 0.3);
  color: #90EE90;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  white-space: nowrap;
}

.countries-comparison {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.country-price {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  padding: 0.75rem;
  border-radius: 8px;
}

.country-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.country-flag {
  font-size: 1.2rem;
}

.country-name {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.price-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.price-info .price {
  font-size: 1.2rem;
  font-weight: bold;
  color: #90EE90;
}

.price-info .store {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
}

.price-difference {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.9rem;
}

.difference-label {
  color: rgba(255, 255, 255, 0.8);
}

.difference-value {
  font-weight: bold;
  padding: 0.25rem 0.5rem;
  border-radius: 5px;
}

.difference-value.positive {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
}

.difference-value.negative {
  background: rgba(81, 207, 102, 0.2);
  color: #51cf66;
}

.no-comparison-data {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.empty-state {
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

.empty-state h3 {
  margin-bottom: 1rem;
  color: rgba(255, 255, 255, 0.9);
}

.empty-state p {
  margin-bottom: 2rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
}

.fetch-data-btn {
  background: linear-gradient(45deg, #4CAF50, #45a049);
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
}

.fetch-data-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

@media (max-width: 768px) {
  .comparison-stats {
    grid-template-columns: 1fr;
  }
  
  .comparison-grid {
    grid-template-columns: 1fr;
  }
}
</style>