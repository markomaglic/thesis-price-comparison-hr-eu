<template>
  <div id="app">
    <AppHeader />

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
      <DashboardTab
        v-if="activeTab === 'dashboard'"
        :database-products="databaseProducts"
        :last-update="lastUpdate"
        :countries="countries"
      />

      <!-- Data Fetching Tab -->
      <DataFetchingTab v-if="activeTab === 'fetching'" />

      <!-- Price Comparison Tab -->
      <PriceComparisonTab
        v-if="activeTab === 'comparison'"
        :comparison-data="comparisonData"
        :average-price-croatia="averagePriceCroatia"
        :average-price-eu="averagePriceEU"
        :price-difference="priceDifference"
        @load-comparison="loadComparisonData"
      />

      <!-- Product Chart Tab -->
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
import AppHeader from "./components/AppHeader.vue";
import DashboardTab from "./components/DashboardTab.vue";
import DataFetchingTab from "./components/DataFetchingTab.vue";
import PriceComparisonTab from "./components/PriceComparisonTab.vue";
import ProductChartTab from "./components/ProductChartTab.vue";
import PriceHistoryTab from "./components/PriceHistoryTab.vue";
import ApiTestTab from "./components/ApiTestTab.vue";

// Global UI styles (design tokens + shared UI)
import "@/styles/theme.css";
import "@/styles/ui.css";

export default {
  name: "ThesisPriceComparisonApp",
  components: {
    AppHeader,
    DashboardTab,
    DataFetchingTab,
    PriceComparisonTab,
    ProductChartTab,
    PriceHistoryTab,
    ApiTestTab,
  },
  data() {
    return {
      activeTab: "dashboard",
      tabs: [
        { id: "dashboard", name: "Dashboard" },
        { id: "fetching", name: "Lidl Scraping" },
        { id: "comparison", name: "Price Comparison" },
        { id: "product-chart", name: "Product Charts" },
        { id: "price-history", name: "Price History" },
        { id: "api", name: "API & Stats" },
      ],
      fetchingStatus: "idle",
      databaseProducts: [],
      comparisonData: [],
      searchResults: [],
      searchQuery: "",
      lastSearchQuery: "",
      apiResponse: null,
      statistics: null,
      databaseProductsCount: 0,
      lastUpdate: null,
      countries: ["Hrvatska", "Germany", "Slovenia", "Austria"],
      searchExamples: ["milk", "bread", "Milbona", "cheese", "yogurt", "pasta"],
      availableCategories: [],

      // Price History Data
      priceComparisonData: [],
      productPriceHistory: [],
      trendingProducts: [],
      loadingHistory: false,
      priceHistoryQuery: "",
      lastHistoryQuery: "",
      selectedCountryFilter: "",
      maxPrice: 5,
      minProductPrice: "0.00",
      maxProductPrice: "0.00",
      averageProductPrice: "0.00",
    };
  },
  computed: {
    averagePriceCroatia() {
      if (!this.comparisonData.length) return "0.00";
      let total = 0;
      let count = 0;
      this.comparisonData.forEach((product) => {
        if (product.countries["Hrvatska"]) {
          total += product.countries["Hrvatska"].price;
          count++;
        }
      });
      return count > 0 ? (total / count).toFixed(2) : "0.00";
    },
    averagePriceEU() {
      if (!this.comparisonData.length) return "0.00";
      let total = 0;
      let count = 0;
      this.comparisonData.forEach((product) => {
        ["Germany", "Austria", "Slovenia"].forEach((country) => {
          if (product.countries[country]) {
            total += product.countries[country].price;
            count++;
          }
        });
      });
      return count > 0 ? (total / count).toFixed(2) : "0.00";
    },
    priceDifference() {
      const hrPrice = parseFloat(this.averagePriceCroatia);
      const euPrice = parseFloat(this.averagePriceEU);
      if (euPrice === 0) return 0;
      return (((hrPrice - euPrice) / euPrice) * 100).toFixed(1);
    },
  },
  async mounted() {
    await this.loadDatabaseProducts();
    await this.loadComparisonData();
    await this.loadStatistics();
    await this.loadCategories();
  },
  methods: {
    // API helper
    getApiUrl(path) {
      return `http://localhost:3001${path}`;
    },

    // Database Methods
    async loadDatabaseProducts() {
      try {
        const countries = ["de", "at", "si", "hr"];
        let allProducts = [];
        for (const country of countries) {
          try {
            const response = await fetch(this.getApiUrl(`/api/products/${country}`));
            const data = await response.json();
            if (data.success && data.data) {
              const countryProducts = data.data.map((p) => ({
                ...p,
                country: this.getCountryName(country),
              }));
              allProducts = [...allProducts, ...countryProducts];
            }
          } catch (error) {
            console.error(`Error loading products for ${country}:`, error);
          }
        }
        this.databaseProducts = allProducts;
        this.databaseProductsCount = allProducts.length;
        this.lastUpdate = new Date().toISOString();
        console.log(`Loaded ${allProducts.length} total products`);
      } catch (error) {
        console.error("Error loading database products:", error);
      }
    },

    async loadComparisonData() {
      try {
        console.log("Loading comparison data...");
        const response = await fetch(this.getApiUrl("/api/compare"));
        const data = await response.json();
        if (data.success) {
          this.comparisonData = data.data;
          console.log(`Loaded ${data.count} products for comparison`);
          if (data.count > 0) {
            this.showNotification(
              `Successfully loaded ${data.count} comparable products`,
              "success"
            );
          } else {
            this.showNotification(
              "No comparable products found. Scrape more countries to get matches.",
              "info"
            );
          }
        } else {
          console.error("Comparison failed:", data.error);
          this.showNotification(`Comparison failed: ${data.error}`, "error");
        }
      } catch (error) {
        console.error("Error loading comparison data:", error);
        this.showNotification("Error loading comparison data", "error");
      }
    },

    async loadStatistics() {
      console.log("Statistics endpoint not implemented yet");
      this.statistics = null;
    },

    async loadCategories() {
      console.log("Categories endpoint not implemented yet");
      this.availableCategories = [];
    },

    // Scraping methods
    async handleScrapeCountry(countryCode) {
      this.fetchingStatus = "loading";
      try {
        const countryMap = {
          Germany: "de",
          Austria: "at",
          Slovenia: "si",
          Croatia: "hr",
          Hrvatska: "hr",
        };
        const country = countryMap[countryCode] || countryCode.toLowerCase();
        const response = await fetch(this.getApiUrl(`/api/scrape/${country}`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 30 }),
        });
        const data = await response.json();
        if (data.success) {
          this.showNotification(
            `Successfully scraped ${data.count} products from ${countryCode}`,
            "success"
          );
          this.lastUpdate = new Date().toISOString();
          await this.loadDatabaseProducts();
          await this.loadComparisonData();
        } else {
          this.showNotification(`Scraping failed: ${data.error}`, "error");
        }
      } catch (error) {
        console.error(`Error scraping ${countryCode}:`, error);
        this.showNotification(`Error scraping ${countryCode}: ${error.message}`, "error");
      } finally {
        this.fetchingStatus = "idle";
      }
    },

    // Search methods
    async searchProducts() {
      if (!this.searchQuery || this.searchQuery.length < 2) return;
      this.fetchingStatus = "loading";
      this.lastSearchQuery = this.searchQuery;
      try {
        const q = this.searchQuery.toLowerCase();
        this.searchResults = this.databaseProducts
          .filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              (p.brand && p.brand.toLowerCase().includes(q))
          )
          .slice(0, 20);
        this.showNotification(
          `Found ${this.searchResults.length} products for "${this.searchQuery}"`,
          "success"
        );
      } catch (error) {
        console.error("Error searching products:", error);
        this.showNotification("Search error", "error");
      } finally {
        this.fetchingStatus = "idle";
      }
    },

    quickSearch(term) {
      this.searchQuery = term;
      this.searchProducts();
    },

    // API Testing
    async testEndpoint(endpoint) {
      try {
        const response = await fetch(this.getApiUrl(endpoint));
        const data = await response.json();
        this.apiResponse = { status: response.status, data, endpoint };
      } catch (error) {
        this.apiResponse = { error: error.message, endpoint, status: "Error" };
      }
    },

    // Price History methods
    async generateHistoricalData() {
      this.showNotification("Historical data generation not implemented yet", "info");
    },

    async loadPriceComparison() {
      try {
        const response = await fetch(this.getApiUrl("/api/overview?monthsBack=12"));
        const data = await response.json();
        if (data.success) {
          this.priceComparisonData = data.data;
          this.calculateMaxPrice();
        }
      } catch (error) {
        console.error("Error loading price comparison:", error);
      }
    },

    async loadProductHistory() {
      if (!this.priceHistoryQuery) return;
      try {
        const params = new URLSearchParams({
          name: this.priceHistoryQuery,
          monthsBack: "12",
        });
        if (this.selectedCountryFilter) params.append("country", this.selectedCountryFilter);
        const response = await fetch(this.getApiUrl(`/api/history?${params}`));
        const data = await response.json();
        if (data.success) {
          this.productPriceHistory = data.data;
          this.lastHistoryQuery = this.priceHistoryQuery;
          this.calculateProductPriceStats();
        }
      } catch (error) {
        console.error("Error loading product history:", error);
      }
    },

    async loadTrendingProducts() {
      this.showNotification("Trending products not implemented yet", "info");
    },

    async simulatePriceUpdate() {
      this.showNotification("Price simulation not implemented yet", "info");
    },

    // Helpers
    getCountryName(code) {
      const map = { de: "Germany", at: "Austria", si: "Slovenia", hr: "Hrvatska" };
      return map[code] || code.toUpperCase();
    },

    showNotification(message, type = "info") {
      console.log(`[${type.toUpperCase()}] ${message}`);
      const icons = { success: "Success", error: "Error", warning: "Warning", info: "Info" };
      alert(`${icons[type] || icons.info}: ${message}`);
    },

    calculateMaxPrice() {
      let max = 0;
      this.priceComparisonData.forEach((d) => {
        Object.values(d.countries || {}).forEach((c) => {
          const price = parseFloat(c.avgPrice);
          if (price > max) max = price;
        });
      });
      this.maxPrice = Math.ceil(max);
    },

    calculateProductPriceStats() {
      if (!this.productPriceHistory.length) return;
      const prices = this.productPriceHistory.map((e) => e.price);
      this.minProductPrice = Math.min(...prices).toFixed(2);
      this.maxProductPrice = Math.max(...prices).toFixed(2);
      this.averageProductPrice = (
        prices.reduce((s, p) => s + p, 0) / prices.length
      ).toFixed(2);
    },

    formatDate(d) {
      if (!d) return "Never";
      return new Date(d).toLocaleDateString("hr-HR");
    },
    formatTime(d) {
      if (!d) return "--:--";
      return new Date(d).toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" });
    },
    formatDateTime(d) {
      if (!d) return "Unknown";
      return new Date(d).toLocaleString("hr-HR");
    },
  },
};
</script>

<style>
@import "@/styles/theme.css";
@import "@/styles/ui.css";
@import "@/assets/styles/main.css";

.positive { color: #ff6b6b !important; }
.negative { color: #51cf66 !important; }
</style>
