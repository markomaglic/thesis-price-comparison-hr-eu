<!-- DataFetchingTab.vue -->
<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from "vue";

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

/* --- countries --- */
const countries = [
  { code: "de", label: "Germany" },
  { code: "at", label: "Austria" },
  { code: "si", label: "Slovenia" },
  { code: "hr", label: "Croatia" },
];
const allCodes = countries.map(c => c.code);
const selected = ref(["de", "at"]);
const limit = ref(50);

/* --- activity --- */
const activity = ref([]); // {id,type,time,text}
const activityBox = ref(null);
const fmt = (d) => d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" });
const codeToLabel = (c) => countries.find(x => x.code === c)?.label || c.toUpperCase();
const randId = () => Math.random().toString(36).slice(2);
function pushLog(type, text) {
  activity.value.unshift({ id: randId(), type, time: new Date(), text });
  nextTick(() => { if (activityBox.value) activityBox.value.scrollTop = 0; });
}
function clearActivity(){ activity.value = []; }

/* --- tiles: ALWAYS show products --- */
const allItems = ref([]);     // unified list across countries
const lastUpdated = ref(null);
const autoRefresh = ref(false);
const refreshSeconds = ref(60);
let refreshTimer = null;

function mapRow(code, r) {
  const name = r.name ?? r.title ?? "";
  const brand = r.brand ?? null;
  const unit = r.unit ?? r.unit_text ?? null;
  const price = r.price ?? r.price_eur ?? null;
  const currency = r.currency ?? "EUR";
  const url = r.item_link || r.url || null;
  const id = `${code}|${(r.gtin || "").toString()}|${name}|${brand||""}`;
  return { id, name, brand, unit, price, currency, country: code, url };
}
function uniqBy(arr, key="id") {
  const seen = new Set(); const out = [];
  for (const x of arr) { if (seen.has(x[key])) continue; seen.add(x[key]); out.push(x); }
  return out;
}

async function loadTiles(codes = allCodes) {
  const batches = await Promise.allSettled(
    codes.map(c => apiGet(`/api/products/${c}`).then(r => ({ code: c, rows: r.data || [] })))
  );
  const merged = [];
  for (const b of batches) {
    if (b.status === "fulfilled") {
      const { code, rows } = b.value;
      merged.push(...rows.map(r => mapRow(code, r)));
    } else {
      const idx = batches.indexOf(b);
      pushLog("warn", `Failed to load products for ${codeToLabel(codes[idx])}`);
    }
  }
  allItems.value = uniqBy(merged).slice(0, 500);
  lastUpdated.value = new Date();
}
function clearTiles(){ allItems.value = []; }

function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => loadTiles(allCodes), Math.max(5, refreshSeconds.value) * 1000);
}
function stopAutoRefresh() { if (refreshTimer) clearInterval(refreshTimer); refreshTimer = null; }
function toggleAutoRefresh() { autoRefresh.value ? startAutoRefresh() : stopAutoRefresh(); }

onMounted(async () => {
  await loadTiles(allCodes);                 // load on mount (always visible)
  if (autoRefresh.value) startAutoRefresh();
});
onBeforeUnmount(() => stopAutoRefresh());

/* --- samples (optional) --- */
const samples = ref({});
const totalSelected = computed(() => selected.value.length);

/* --- scraping --- */
const running = ref(false);

async function scrapeCountry(code) {
  const label = codeToLabel(code);
  const resp = await apiPost(`/api/scrape/${code}`, { limit: limit.value });
  pushLog("ok", `${label}: scraped ${resp.count} items`);

  // refresh that country's tiles & sample
  const latest = await apiGet(`/api/products/${code}`);
  const rows = latest.data || [];
  samples.value[code] = rows.slice(0, 8);
  allItems.value = uniqBy([...rows.map(r => mapRow(code, r)), ...allItems.value]).slice(0, 500);
  lastUpdated.value = new Date();
  pushLog(rows.length ? "info" : "warn", `${label}: latest has ${rows.length} items`);
}

async function runScrape() {
  if (!selected.value.length) { pushLog("warn","Select at least one country."); return; }
  running.value = true;
  pushLog("info", `Starting scrape for ${selected.value.map(codeToLabel).join(", ")} (limit ${limit.value})`);
  for (const code of selected.value) {
    try { await scrapeCountry(code); await new Promise(r => setTimeout(r, 250)); }
    catch (e) { pushLog("err", `${codeToLabel(code)}: ${e?.message || e}`); }
  }
  try {
    const cmp = await apiGet(`/api/compare`);
    pushLog("ok", `Compare ready: ${cmp.count} grouped products`);
  } catch (e) {
    pushLog("warn", `Compare: ${e?.message || e}`);
  }
  running.value = false;
}

async function testProducts() {
  if (selected.value.length !== 1) { pushLog("info","Pick exactly one country for Test."); return; }
  const c = selected.value[0];
  const latest = await apiGet(`/api/products/${c}`);
  samples.value[c] = (latest.data || []).slice(0, 8);
  pushLog((latest.data || []).length ? "info" : "warn",
          `${codeToLabel(c)}: latest has ${(latest.data || []).length} items`);
}
</script>

<template>
  <section class="df-wrap">
    <header class="df-head">
      <h2>Lidl Data Fetching</h2>
      <p>Products are always visible below. Scrape to update them.</p>
    </header>

    <!-- Controls -->
    <div class="df-controls">
      <div class="country-list">
        <label v-for="c in countries" :key="c.code" class="chip">
          <input type="checkbox" v-model="selected" :value="c.code" />
          <span class="pill">{{ c.code.toUpperCase() }}</span>
          <span class="label">{{ c.label }}</span>
        </label>
      </div>

      <div class="limit">
        <label for="limit">Limit</label>
        <input id="limit" type="number" min="10" max="500" v-model.number="limit" />
      </div>

      <div class="actions">
        <button class="btn main" :disabled="running || totalSelected === 0" @click="runScrape">
          <span v-if="running" class="spinner" aria-hidden="true"></span>
          {{ running ? "Scraping…" : "Run scrape (selected)" }}
        </button>

        <button class="btn ghost" :disabled="running || totalSelected !== 1" @click="testProducts">
          Test /api/products (selected)
        </button>

        <button class="btn ghost" @click="loadTiles(allCodes)">Refresh tiles</button>

        <label class="auto">
          <input type="checkbox" v-model="autoRefresh" @change="toggleAutoRefresh" />
          Auto-refresh
        </label>
        <input class="interval" type="number" min="5" max="600" v-model.number="refreshSeconds" :disabled="!autoRefresh" />
        <span class="sec">sec</span>

        <button class="btn ghost" :disabled="!activity.length" @click="clearActivity">Clear activity</button>
        <button class="btn ghost" :disabled="!allItems.length" @click="clearTiles">Clear tiles</button>
      </div>
    </div>

    <!-- Row: Activity | Samples -->
    <div class="df-panels">
      <!-- Activity -->
      <div class="panel">
        <div class="panel-head">
          <h3>Activity</h3>
          <span class="badge">{{ activity.length }}</span>
        </div>
        <div class="activity" ref="activityBox">
          <div v-if="!activity.length" class="empty">No activity yet.</div>
          <ul v-else class="activity-list">
            <li v-for="row in activity" :key="row.id" class="item" :data-type="row.type">
              <span class="dot" aria-hidden="true"></span>
              <time :title="row.time.toISOString()">{{ fmt(row.time) }}</time>
              <span class="text">{{ row.text }}</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Samples -->
      <div class="panel">
        <div class="panel-head">
          <h3>Samples (by country)</h3>
        </div>

        <div class="sample-grid">
          <div v-for="c in countries" :key="c.code" class="sample">
            <h4>{{ c.code.toUpperCase() }}</h4>
            <table>
              <thead>
                <tr>
                  <th style="width:40%">Name</th>
                  <th>Brand</th>
                  <th>Unit</th>
                  <th style="text-align:right">Price (€)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in (samples[c.code] || [])" :key="r.item_link || r.url || r.name">
                  <td>{{ r.name ?? r.title }}</td>
                  <td>{{ r.brand }}</td>
                  <td>{{ r.unit ?? r.unit_text }}</td>
                  <td style="text-align:right">{{ (r.price ?? r.price_eur)?.toFixed?.(2) ?? r.price }}</td>
                </tr>
                <tr v-if="!(samples[c.code] || []).length">
                  <td colspan="4" class="no-rows">No rows</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p class="hint">
          Scraping updates both tiles and samples. Without DB, tiles reflect what's in backend memory.
        </p>
      </div>
    </div>

    <!-- FULL-WIDTH Products panel UNDER Activity & Samples -->
    <div class="panel tiles-panel">
      <div class="panel-head">
        <h3>Products</h3>
        <span class="badge">
          {{ allItems.length }}
          <span v-if="lastUpdated" class="dim">· {{ fmt(lastUpdated) }}</span>
        </span>
      </div>
      <div class="tiles-grid">
        <div class="tile" v-for="it in allItems" :key="it.id">
          <div class="tile-top">
            <span class="country" :data-code="it.country">{{ it.country.toUpperCase() }}</span>
            <span class="price">{{ it.price?.toFixed?.(2) ?? it.price }}<span class="cur">€</span></span>
          </div>
          <div class="name" :title="it.name">{{ it.name }}</div>
          <div class="meta">
            <span>{{ it.brand || '—' }}</span>
            <span v-if="it.unit">· {{ it.unit }}</span>
          </div>
          <a v-if="it.url" class="open" :href="it.url" target="_blank" rel="noopener">open</a>
        </div>
        <div v-if="!allItems.length" class="no-rows">No items yet</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Layout */
.df-wrap { display:flex; flex-direction:column; gap:16px; padding:16px; }
.df-head h2 { margin:0 0 4px; }
.df-head p { margin:0; opacity:.85; }

/* Controls */
.df-controls { display:flex; gap:16px; flex-wrap:wrap; align-items:center; }
.country-list { display:flex; gap:10px; flex-wrap:wrap; }
.chip { display:flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid rgba(255,255,255,.25); border-radius:9999px; background:rgba(255,255,255,.08); }
.chip input { transform: translateY(1px); }
.chip .pill { font-weight:700; background:rgba(255,255,255,.15); padding:2px 8px; border-radius:9999px; }
.limit { display:flex; align-items:center; gap:8px; }
.limit input { width:84px; padding:6px 8px; border:1px solid rgba(0,0,0,.1); border-radius:8px; background:rgba(255,255,255,.9); }

.actions { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
.btn { padding:10px 14px; border-radius:12px; border:0; cursor:pointer; font-weight:600; }
.btn.main { background:#111827; color:#fff; }
.btn.ghost { background:rgba(255,255,255,.85); color:#111827; }
.btn:disabled { cursor:not-allowed; opacity:.6; }
.auto { display:flex; align-items:center; gap:6px; }
.interval { width:70px; padding:6px 8px; border:1px solid rgba(0,0,0,.1); border-radius:8px; background:rgba(255,255,255,.9); }
.sec { opacity:.85; }

/* Spinner */
.spinner { display:inline-block; width:14px; height:14px; margin-right:8px; border:2px solid rgba(255,255,255,.4); border-top-color:#fff; border-radius:50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); }}

/* Two-column row */
.df-panels { display:grid; grid-template-columns:1fr; gap:16px; }
@media (min-width: 1024px) { .df-panels { grid-template-columns: 1fr 1fr; } }

/* Panels */
.panel { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.18); border-radius:16px; overflow:hidden; }
.panel-head { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.15); }
.badge { font-size:12px; padding:2px 8px; border-radius:999px; background:rgba(255,255,255,.2); }
.dim { opacity:.7; }

/* Activity */
.activity { max-height:240px; overflow:auto; padding:8px 10px; }
.empty { padding:16px; opacity:.7; }
.activity-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.item { display:grid; grid-template-columns:auto 72px 1fr; align-items:start; gap:10px; padding:8px 10px; border-radius:12px; background:rgba(255,255,255,.06); }
.item time { font-variant-numeric: tabular-nums; opacity:.85; }
.item .text { line-height:1.3; }
.item .dot { width:10px; height:10px; border-radius:50%; margin-top:3px; }
.item[data-type="ok"]   .dot { background:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,.2); }
.item[data-type="info"] .dot { background:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.2); }
.item[data-type="warn"] .dot { background:#f59e0b; box-shadow:0 0 0 3px rgba(245,158,11,.2); }
.item[data-type="err"]  .dot { background:#ef4444; box-shadow:0 0 0 3px rgba(239,68,68,.2); }

/* FULL-WIDTH tiles panel */
.tiles-panel { /* sits under the two-column row */ }
.tiles-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:12px; padding:12px; }
@media (min-width: 1024px) { .tiles-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1440px) { .tiles-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.tile { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.16); border-radius:12px; padding:10px; display:flex; flex-direction:column; gap:6px; min-height:96px; }
.tile-top { display:flex; align-items:center; justify-content:space-between; }
.country { font-size:12px; font-weight:700; padding:2px 8px; border-radius:999px; background:rgba(59,130,246,.18); }
.country[data-code="de"] { background:rgba(59,130,246,.18); }
.country[data-code="at"] { background:rgba(16,185,129,.18); }
.country[data-code="si"] { background:rgba(245,158,11,.22); }
.country[data-code="hr"] { background:rgba(239,68,68,.20); }
.price { font-weight:800; letter-spacing:.2px; }
.price .cur { opacity:.85; margin-left:2px; font-weight:600; }
.name { font-weight:600; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.meta { opacity:.9; font-size:13px; }
.open { align-self:flex-start; margin-top:4px; font-size:12px; text-decoration:underline; opacity:.85; }

/* Samples */
.sample-grid { display:grid; grid-template-columns:1fr; gap:12px; padding:12px; }
@media (min-width: 768px) { .sample-grid { grid-template-columns: 1fr 1fr; } }
.sample h4 { margin:8px 0; font-weight:700; }
.sample table { width:100%; border-collapse: collapse; overflow:hidden; border-radius:10px; }
.sample th, .sample td { border-bottom:1px solid rgba(255,255,255,.12); padding:6px 8px; font-size:14px; }
.sample th { text-align:left; opacity:.9; }
.no-rows { opacity:.6; text-align:center; padding:10px 0; }
.hint { opacity:.8; padding:0 12px 12px; }
</style>
