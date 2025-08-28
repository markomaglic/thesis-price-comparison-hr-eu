import "dotenv/config";
import express from "express";
import cors from "cors";
import { scrapeCountry } from "./scrapers/lidlScraper.js";
import { normalizeForComparison, compareAcrossCountries } from "./services/normalizer.js";
import { persistRows, getLatestByCountry, getCompareView,
         getMonthlyAverages, getPriceHistory,
         generateSyntheticHistory } from "./services/dbAdapter.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/scrape/:country", async (req, res) => {
  const country = (req.params.country || "").toLowerCase(); // hr|si|at|de
  const { limit = 200 } = req.body || {};
  
  console.log(`\n=== SCRAPE REQUEST FOR ${country.toUpperCase()} ===`);
  console.log(`Limit: ${limit}`);
  
  try {
    // Step 1: Scrape raw data
    console.log("Step 1: Scraping...");
    const raw = await scrapeCountry(country, { limit });
    console.log(`Raw scraped data: ${raw.length} items`);
    console.log("Sample raw item:", JSON.stringify(raw[0], null, 2));

    // Step 2: Normalize data
    console.log("Step 2: Normalizing...");
    const normalized = raw.map(normalizeForComparison(country));
    console.log(`Normalized data: ${normalized.length} items`);
    console.log("Sample normalized item:", JSON.stringify(normalized[0], null, 2));

    // Step 3: Persist to database
    console.log("Step 3: Persisting to database...");
    const dbResult = await persistRows(country, normalized);
    console.log("Database result:", dbResult);

    console.log(`=== SUCCESS: ${country.toUpperCase()} ===`);
    res.json({ 
      success: true, 
      country, 
      count: normalized.length,
      dbInserted: dbResult.inserted,
      sessionId: dbResult.sessionId 
    });

  } catch (e) { 
    console.error(`=== ERROR: ${country.toUpperCase()} ===`);
    console.error("Error details:", e);
    console.error("Stack trace:", e.stack);
    
    res.status(500).json({ 
      success: false, 
      error: e.message,
      country 
    }); 
  }
});

app.get("/api/products/:country", async (req, res) => {
  const country = (req.params.country || "").toLowerCase();
  res.json({ success: true, country, data: await getLatestByCountry(country) });
});

// Fixed server.js compare endpoint
// Updated server.js compare endpoint with better matching
app.get("/api/compare", async (_req, res) => {
  try {
    // Get raw comparison data from database
    const rawData = await getCompareView();
    
    console.log(`Raw DB data: ${rawData.length} rows`);
    
    // Group by the improved matching key
    const groupedProducts = new Map();
    
    for (const row of rawData) {
      // Use the key from normalized data
      const productKey = row.compare_key || row.key;
      
      if (!groupedProducts.has(productKey)) {
        // Extract additional metadata for better display
        const displayName = row.name || 'Unknown Product';
        const brand = row.brand;
        const category = getCategoryFromName(displayName);
        
        groupedProducts.set(productKey, {
          name: displayName,
          brand: brand,
          unit: row.unit,
          category: category,
          countries: {},
          // Add metadata for debugging
          match_type: productKey.startsWith('gtin-') ? 'GTIN' : 
                     productKey.startsWith('brand-') ? 'Brand+Size' : 'Fallback'
        });
      }
      
      // Add country data
      const product = groupedProducts.get(productKey);
      const countryName = getCountryDisplayName(row.country);
      
      product.countries[countryName] = {
        price: parseFloat(row.price),
        currency: 'EUR',
        store: 'Lidl',
        scraped_at: row.scraped_at,
        price_type: row.price_type || 'regular',
        url: row.url || '#'
      };
    }
    
    // Convert to array and filter products that exist in 2+ countries
    const comparisonData = Array.from(groupedProducts.values())
      .filter(product => Object.keys(product.countries).length >= 2)
      .sort((a, b) => {
        // Sort by number of countries (most first), then by match type, then by name
        const countryDiff = Object.keys(b.countries).length - Object.keys(a.countries).length;
        if (countryDiff !== 0) return countryDiff;
        
        const matchTypePriority = { 'GTIN': 3, 'Brand+Size': 2, 'Fallback': 1 };
        const matchDiff = (matchTypePriority[b.match_type] || 0) - (matchTypePriority[a.match_type] || 0);
        if (matchDiff !== 0) return matchDiff;
        
        return a.name.localeCompare(b.name);
      });
    
    console.log(`Grouped into ${comparisonData.length} comparable products`);
    console.log(`Match types: GTIN: ${comparisonData.filter(p => p.match_type === 'GTIN').length}, Brand+Size: ${comparisonData.filter(p => p.match_type === 'Brand+Size').length}, Fallback: ${comparisonData.filter(p => p.match_type === 'Fallback').length}`);
    
    // Log some examples for debugging
    if (comparisonData.length > 0) {
      console.log('Sample matches:');
      comparisonData.slice(0, 3).forEach(product => {
        console.log(`- ${product.name} (${product.match_type}): Available in ${Object.keys(product.countries).join(', ')}`);
      });
    }
    
    res.json({ 
      success: true, 
      count: comparisonData.length, 
      data: comparisonData 
    });
    
  } catch (error) {
    console.error('Compare endpoint error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Helper functions
function getCategoryFromName(name) {
  if (!name) return 'Other';
  
  const nameLower = name.toLowerCase();
  
  if (/milch|mlijeko|mleko|milk|jogurt|joghurt|yogurt|sir|käse|cheese|butter/i.test(nameLower)) {
    return 'Dairy';
  }
  if (/brot|kruh|bread|pecivo|cake|kuchen|donut/i.test(nameLower)) {
    return 'Bakery';
  }
  if (/fleisch|meso|meat|wurst|kobasica|chicken|piletina/i.test(nameLower)) {
    return 'Meat';
  }
  if (/fruit|voće|obst|banana|apple|jabuka|orange/i.test(nameLower)) {
    return 'Produce';
  }
  if (/getränk|piće|drink|water|voda|juice|sok/i.test(nameLower)) {
    return 'Beverages';
  }
  
  return 'Other';
}

function getCountryDisplayName(country) {
  const countryMap = {
    'Germany': 'Germany',
    'Austria': 'Austria',
    'Slovenia': 'Slovenia', 
    'Hrvatska': 'Hrvatska',
    'de': 'Germany',
    'at': 'Austria',
    'si': 'Slovenia',
    'hr': 'Hrvatska'
  };
  return countryMap[country] || country;
}

app.post("/api/prices/generate-history", async (req, res) => {
  try {
    const monthsBack = Number(req.body?.monthsBack || 12);
    const data = await generateSyntheticHistory(monthsBack);
    res.json({ success: true, message: `Generated ${monthsBack} months of history.`, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// History by product name (wrapper over your getPriceHistory)
app.get("/api/prices/history/:name", async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name || "");
    const country = req.query.country || null;          // full name works best (Germany/Austria/Slovenia/Hrvatska)
    const monthsBack = Number(req.query.monthsBack || 12);
    const data = await getPriceHistory(name, country, monthsBack);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get("/api/history", async (req, res) => {
  const { name, country, monthsBack = 12 } = req.query;
  const data = await getPriceHistory(String(name||""), country || null, Number(monthsBack));
  res.json({ success: true, count: data.length, data });
});

app.get("/api/overview", async (req, res) => {
  const monthsBack = Number(req.query.monthsBack || 12);
  const data = await getMonthlyAverages(monthsBack);
  res.json({ success: true, data });
});

app.listen(process.env.PORT || 3001);