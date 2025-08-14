<template>
  <div class="tab-content">
    <h2>📊 Dashboard</h2>

    <div class="dashboard-stats">
      <div class="stat-card">
        <h3>🛒 Database Products</h3>
        <span class="stat-number">{{ databaseProductsCount }}</span>
        <small>Real products stored</small>
      </div>
      <div class="stat-card">
        <h3>🌍 Countries</h3>
        <span class="stat-number">{{ countries.length }}</span>
        <small>HR, DE, SI, AT</small>
      </div>
      <div class="stat-card">
        <h3>💰 Currency</h3>
        <span class="stat-number">EUR</span>
        <small>European Union</small>
      </div>
      <div class="stat-card">
        <h3>⏰ Last Update</h3>
        <span class="stat-number">{{ formatTime(lastUpdate) }}</span>
        <small>{{ lastUpdate ? formatDate(lastUpdate) : 'Never' }}</small>
      </div>
    </div>

    <div v-if="databaseProducts.length > 0" class="country-breakdown">
      <h4>Products by Country</h4>
      <div class="country-items">
        <div
          v-for="(count, country) in countryBreakdown"
          :key="country"
          class="country-pill"
        >
          <span class="country-flag">{{ getCountryFlag(country) }}</span>
          <span class="country-name">{{ country }}</span>
          <span class="country-count">{{ count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DashboardTab',
  props: {
    databaseProducts: {
      type: Array,
      default: () => []
    },
    lastUpdate: {
      type: String,
      default: null
    },
    countries: {
      type: Array,
      default: () => []
    }
  },
  computed: {
    databaseProductsCount() {
      return this.databaseProducts.length;
    },
    countryBreakdown() {
      const breakdown = {};
      this.databaseProducts.forEach(product => {
        breakdown[product.country] = (breakdown[product.country] || 0) + 1;
      });
      return breakdown;
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
    }
  }
}
</script>

<style scoped>
.dashboard-stats {
  display: flex;
  flex-direction: column;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
}

.stat-card {
  padding: 1rem;
  text-align: center;
  border-bottom: 1px solid #ddd;
  width: 100%;
}

.stat-card:last-child {
  border-bottom: none;
}

.country-breakdown {
  margin-top: 1.5rem;
}

.country-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.country-pill {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid #ddd;
  border-radius: 20px;
}
</style>
