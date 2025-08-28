<!-- PriceHistoryTab.vue -->
<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue";

const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || "http://localhost:3001";

/* --- tiny API helpers --- */
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* --- UI state --- */
const monthsBackGenerate = ref(12);
const genRunning = ref(false);
const genMsg = ref("");

const countries = [
  { code: "de", name: "Germany" },
  { code: "at", name: "Austria" },
  { code: "si", name: "Slovenia" },
  { code: "hr", name: "Hrvatska" },   // matches your DB value
];

const selectedCountryCode = ref("de");
const selectedCountryName = computed(() => countries.find(c => c.code === selectedCountryCode.value)?.name);

const productOptions = ref([]);       // [{label, value}]
const selectedProduct = ref("");
const monthsBackView = ref(12);

const loadingProducts = ref(false);
const loadingHistory = ref(false);
const historyRows = ref([]);          // [{date, price, country, currency, ...}]
const errorMsg = ref("");

/* --- generate historical data --- */
async function generateHistory() {
  genRunning.value = true;
  genMsg.value = "";
  errorMsg.value = "";
  try {
    const { success, message, data } = await apiPost("/api/prices/generate-history", {
      monthsBack: Number(monthsBackGenerate.value || 12),
    });
    genMsg.value = success
      ? `✅ ${message} • Inserted ${data.insertedCount} rows for ${data.productsProcessed} products.`
      : `⚠️ ${message}`;
  } catch (e) {
    genMsg.value = "";
    errorMsg.value = `Error: ${e?.message || e}`;
  } finally {
    genRunning.value = false;
  }
}

/* --- load products for dropdown (from latest per country) --- */
async function loadProductsForCountry(code) {
  loadingProducts.value = true;
  productOptions.value = [];
  selectedProduct.value = "";
  try {
    const r = await apiGet(`/api/products/${code}`);
    const rows = r.data || [];
    // Build unique option list by product name
    const seen = new Set();
    const opts = [];
    for (const x of rows) {
      const name = x.name ?? x.title;
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      opts.push({ label: name, value: name });
    }
    // sort A–Z
    opts.sort((a, b) => a.label.localeCompare(b.label));
    productOptions.value = opts;
    // preselect first to speed testing
    if (opts.length) selectedProduct.value = opts[0].value;
  } catch (e) {
    errorMsg.value = `Failed to load products: ${e?.message || e}`;
  } finally {
    loadingProducts.value = false;
  }
}

/* --- load price history for chosen product/country --- */
async function loadHistory() {
  errorMsg.value = "";
  historyRows.value = [];
  if (!selectedProduct.value) return;

  loadingHistory.value = true;
  try {
    // endpoint expects encoded product and full country name
    const p = encodeURIComponent(selectedProduct.value);
    const c = encodeURIComponent(selectedCountryName.value || "");
    const m = Number(monthsBackView.value || 12);
    const r = await apiGet(`/api/prices/history/${p}?country=${c}&monthsBack=${m}`);
    const rows = (r.data || []).map(x => ({
      date: new Date(x.date),
      price: Number(x.price),
      currency: x.currency || "EUR",
      country: x.country
    }));
    rows.sort((a, b) => a.date - b.date);
    historyRows.value = rows;
    await nextTick();
    drawChart(); // render SVG path
  } catch (e) {
    errorMsg.value = `Failed to load history: ${e?.message || e}`;
  } finally {
    loadingHistory.value = false;
  }
}

/* --- simple SVG line chart (no external libs) --- */
const svgRef = ref(null);
function drawChart() {
  const el = svgRef.value;
  if (!el) return;
  const data = historyRows.value;
  const w = el.clientWidth || 640;
  const h = 220;
  el.setAttribute("viewBox", `0 0 ${w} ${h}`);

  const inner = { l: 38, r: 8, t: 10, b: 24 };
  const iw = w - inner.l - inner.r;
  const ih = h - inner.t - inner.b;

  // clear previous
  while (el.firstChild) el.removeChild(el.firstChild);

  if (!data.length) {
    const t = document.createElementNS("http://www.w3.org/2000/svg","text");
    t.setAttribute("x", String(w/2)); t.setAttribute("y", String(h/2));
    t.setAttribute("text-anchor","middle"); t.setAttribute("fill","currentColor");
    t.textContent = "No data";
    el.appendChild(t);
    return;
  }

  const minP = Math.min(...data.map(d => d.price));
  const maxP = Math.max(...data.map(d => d.price));
  const minT = data[0].date.getTime();
  const maxT = data[data.length-1].date.getTime();

  const x = (t) => inner.l + ((t - minT) / Math.max(1, (maxT - minT))) * iw;
  const y = (p) => inner.t + ih - ((p - minP) / Math.max(0.01, (maxP - minP))) * ih;

  // grid lines (months)
  const months = [...new Set(data.map(d => `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,'0')}`))];
  months.forEach(m => {
    const dt = new Date(m + "-01T00:00:00Z").getTime();
    const gx = x(dt);
    const line = document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1", gx); line.setAttribute("y1", inner.t);
    line.setAttribute("x2", gx); line.setAttribute("y2", inner.t + ih);
    line.setAttribute("stroke", "rgba(255,255,255,.15)");
    line.setAttribute("stroke-width", "1");
    el.appendChild(line);

    const label = document.createElementNS("http://www.w3.org/2000/svg","text");
    label.setAttribute("x", gx); label.setAttribute("y", h-6);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "10");
    label.setAttribute("fill", "currentColor");
    label.textContent = m.slice(2); // YY-MM
    el.appendChild(label);
  });

  // axes
  const ax = document.createElementNS("http://www.w3.org/2000/svg","line");
  ax.setAttribute("x1", inner.l); ax.setAttribute("y1", inner.t + ih);
  ax.setAttribute("x2", inner.l + iw); ax.setAttribute("y2", inner.t + ih);
  ax.setAttribute("stroke", "rgba(255,255,255,.3)"); ax.setAttribute("stroke-width","1.2");
  el.appendChild(ax);

  const ay = document.createElementNS("http://www.w3.org/2000/svg","line");
  ay.setAttribute("x1", inner.l); ay.setAttribute("y1", inner.t);
  ay.setAttribute("x2", inner.l); ay.setAttribute("y2", inner.t + ih);
  ay.setAttribute("stroke", "rgba(255,255,255,.3)"); ay.setAttribute("stroke-width","1.2");
  el.appendChild(ay);

  // y labels (min/mid/max)
  const ys = [minP, (minP+maxP)/2, maxP];
  ys.forEach(v => {
    const ty = y(v);
    const label = document.createElementNS("http://www.w3.org/2000/svg","text");
    label.setAttribute("x", 4); label.setAttribute("y", ty + 3);
    label.setAttribute("font-size", "10"); label.setAttribute("fill", "currentColor");
    label.textContent = v.toFixed(2) + "€";
    el.appendChild(label);
  });

  // line path
  const path = document.createElementNS("http://www.w3.org/2000/svg","path");
  const d = data.map((d,i) => `${i ? "L" : "M"} ${x(d.date.getTime())} ${y(d.price)}`).join(" ");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  el.appendChild(path);

  // points
  data.forEach(d0 => {
    const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx", x(d0.date.getTime())); c.setAttribute("cy", y(d0.price));
    c.setAttribute("r", "2.5"); c.setAttribute("fill", "currentColor");
    el.appendChild(c);
  });
}

/* --- lifecycles --- */
onMounted(async () => {
  await loadProductsForCountry(selectedCountryCode.value);
  if (selectedProduct.value) await loadHistory();
});
watch(selectedCountryCode, async (val) => {
  await loadProductsForCountry(val);
  if (selectedProduct.value) await loadHistory();
});
watch([selectedProduct, monthsBackView], async () => {
  if (selectedProduct.value) await loadHistory();
});
</script>

<template>
  <section class="ph-wrap">
    <!-- Block 1: Generate historical data -->
    <div class="panel">
      <div class="panel-head">
        <h3>Generate historical data</h3>
      </div>
      <div class="row">
        <label class="lbl">Months</label>
        <input class="num" type="number" min="3" max="36" v-model.number="monthsBackGenerate" />
        <button class="btn main" :disabled="genRunning" @click="generateHistory">
          <span v-if="genRunning" class="spinner" /> {{ genRunning ? "Generating…" : "Generate" }}
        </button>
      </div>
      <p v-if="genMsg" class="ok">{{ genMsg }}</p>
      <p v-if="errorMsg" class="err">{{ errorMsg }}</p>
    </div>

    <!-- Block 2: Select country & product, then show chart -->
    <div class="panel">
      <div class="panel-head">
        <h3>Price history viewer</h3>
      </div>

      <div class="row">
        <label class="lbl">Country</label>
        <select class="sel" v-model="selectedCountryCode">
          <option v-for="c in countries" :key="c.code" :value="c.code">
            {{ c.name }}
          </option>
        </select>

        <label class="lbl">Product</label>
        <select class="sel" v-model="selectedProduct" :disabled="loadingProducts || !productOptions.length">
          <option v-if="loadingProducts" value="">Loading…</option>
          <option v-else-if="!productOptions.length" value="">No products</option>
          <option v-for="o in productOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>

        <label class="lbl">Months</label>
        <input class="num" type="number" min="3" max="36" v-model.number="monthsBackView" />
      </div>

      <div class="chart-wrap">
        <svg ref="svgRef" class="chart"></svg>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:30%">Date</th>
              <th style="width:20%">Country</th>
              <th style="text-align:right">Price (€)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r,i) in historyRows" :key="i">
              <td>{{ r.date.toLocaleDateString() }}</td>
              <td>{{ r.country }}</td>
              <td style="text-align:right">{{ r.price.toFixed(2) }}</td>
            </tr>
            <tr v-if="!historyRows.length">
              <td colspan="3" class="muted">No data</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="loadingHistory" class="info">Loading price history…</p>
    </div>
  </section>
</template>

<style scoped>
.ph-wrap { display:flex; flex-direction:column; gap:16px; padding:16px; }

/* panels */
.panel { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.18); border-radius:16px; }
.panel-head { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.15); }
.row { display:flex; gap:10px; align-items:center; padding:12px 14px; flex-wrap:wrap; }

.lbl { opacity:.9; font-weight:600; }
.sel, .num { padding:8px 10px; border-radius:10px; border:1px solid rgba(0,0,0,.1); background:rgba(255,255,255,.95); color:#111827; }
.num { width:90px; }

.btn { padding:10px 14px; border-radius:12px; border:0; cursor:pointer; font-weight:700; }
.btn.main { background:#111827; color:#fff; }
.btn:disabled { opacity:.6; cursor:not-allowed; }

.ok { color:#10b981; padding:0 14px 12px; }
.err { color:#ef4444; padding:0 14px 12px; }
.info { opacity:.85; padding:0 14px 12px; }

/* spinner */
.spinner { display:inline-block; width:14px; height:14px; margin-right:8px;
  border:2px solid rgba(255,255,255,.4); border-top-color:#fff; border-radius:50%;
  animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); }}

/* chart */
.chart-wrap { padding: 8px 14px 14px; }
.chart { width: 100%; height: 240px; display:block; color: #fff; }

/* table */
.table-wrap { padding: 6px 14px 14px; }
table { width:100%; border-collapse:collapse; font-size:14px; }
th, td { border-bottom:1px solid rgba(255,255,255,.12); padding:6px 8px; }
.muted { opacity:.6; text-align:center; }
</style>
