// backend/services/normalizer.js - Improved cross-country matching
import crypto from "crypto";

// Enhanced parser for unit content with better standardization
function parseNetContent(unit_text = "") {
  if (!unit_text) {
    return { qty: null, base: null, baseUnit: null };
  }
  
  const t = String(unit_text).replace(",", ".").toLowerCase();

  // Pattern for multipacks like "6 x 0.5 l", "4 x 100g"
  const multi = t.match(/(\d+)\s*[x×]\s*([\d.]+)\s*(l|ml|g|kg)/i);
  if (multi) {
    const cnt = parseFloat(multi[1]);
    const val = parseFloat(multi[2]);
    const unit = multi[3];
    return toBase(val * cnt, unit);
  }

  // Single unit pattern
  const one = t.match(/([\d.]+)\s*(l|ml|g|kg)/i);
  if (one) return toBase(parseFloat(one[1]), one[2]);

  return { qty: null, base: null, baseUnit: null };
}

function toBase(val, unit) {
  if (!Number.isFinite(val)) return { qty: null, base: null, baseUnit: null };
  if (unit === "kg") return { qty: val, base: val, baseUnit: "kg" };
  if (unit === "g")  return { qty: val, base: val / 1000, baseUnit: "kg" };
  if (unit === "l")  return { qty: val, base: val, baseUnit: "l"  };
  if (unit === "ml") return { qty: val, base: val / 1000, baseUnit: "l"  };
  return { qty: val, base: null, baseUnit: null };
}

// Extract and standardize brand names for better matching
function standardizeBrand(brand) {
  if (!brand) return null;
  
  // Convert to lowercase and remove common variations
  return brand.toLowerCase()
    .replace(/\s+/g, '')  // Remove spaces
    .replace(/[®™©]/g, '') // Remove trademark symbols
    .trim();
}

// Create product category from name for additional matching
function getProductCategory(name) {
  if (!name) return 'other';
  
  const nameLower = name.toLowerCase();
  
  // Dairy products
  if (/milch|mlijeko|mleko|milk|jogurt|joghurt|yogurt|sir|käse|cheese|butter|maslo/i.test(nameLower)) {
    return 'dairy';
  }
  
  // Bread and bakery
  if (/brot|kruh|bread|pecivo|cake|kuchen|donut/i.test(nameLower)) {
    return 'bakery';
  }
  
  // Meat products
  if (/fleisch|meso|meat|wurst|kobasica|chicken|piletina|beef|govedina/i.test(nameLower)) {
    return 'meat';
  }
  
  // Fruits and vegetables
  if (/fruit|voće|obst|banana|apple|jabuka|orange|naranča|potato|krumpir/i.test(nameLower)) {
    return 'produce';
  }
  
  // Beverages
  if (/getränk|piće|drink|water|voda|juice|sok|beer|pivo/i.test(nameLower)) {
    return 'beverages';
  }
  
  return 'other';
}

// Round base quantities to standard sizes for better matching
function standardizeSize(base, baseUnit) {
  if (!base || !baseUnit) return null;
  
  // Round to common package sizes
  const commonSizes = {
    'l': [0.25, 0.33, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0],
    'kg': [0.1, 0.2, 0.25, 0.5, 1.0, 1.5, 2.0, 2.5, 5.0]
  };
  
  const sizes = commonSizes[baseUnit] || [];
  
  // Find closest common size
  let closest = base;
  let minDiff = Infinity;
  
  for (const size of sizes) {
    const diff = Math.abs(base - size);
    if (diff < minDiff && diff < base * 0.1) { // Within 10% tolerance
      minDiff = diff;
      closest = size;
    }
  }
  
  return closest;
}

export const normalizeForComparison = (country) => (r) => {
  const { qty, base, baseUnit } = parseNetContent(r.unit_text);
  const unitPrice = base ? r.price / base : null;
  const standardBrand = standardizeBrand(r.brand);
  const category = getProductCategory(r.name);
  const standardSize = standardizeSize(base, baseUnit);

  const priceType =
    r.isLidlPlus ? "lidl_plus" :
    r.isPromo    ? "promo"     :
                   "regular";

  // Improved key generation for cross-country matching
  let key;
  
  if (r.gtin) {
    // Best case: Use GTIN for exact product matching
    key = `gtin-${r.gtin}`;
  } else if (standardBrand && standardSize && baseUnit) {
    // Brand + standardized size + category matching
    key = `brand-${standardBrand}-${standardSize}${baseUnit}-${category}`;
  } else if (standardBrand && category) {
    // Brand + category matching (for products without clear sizes)
    key = `brand-${standardBrand}-${category}`;
  } else {
    // Fallback: Hash of name (least reliable)
    key = crypto.createHash("sha1")
      .update(`${(r.name||"").trim()}`)
      .digest("hex");
  }

  return {
    key,
    country,
    name: r.name,
    brand: r.brand || null,
    gtin: r.gtin || null,
    price_eur: r.price,
    unit_text: r.unit_text || null,
    unit_price_eur: unitPrice ? Number(unitPrice.toFixed(4)) : null,
    unit_base: baseUnit,
    deposit_eur: r.deposit ?? null,
    price_type: priceType,
    url: r.url,
    captured_at: new Date().toISOString(),
    // Additional fields for better matching
    standard_brand: standardBrand,
    category: category,
    standard_size: standardSize
  };
};

export function compareAcrossCountries({ hr = [], si = [], at = [], de = [] }) {
  const map = new Map();
  
  const add = (row) => {
    if (!map.has(row.key)) {
      map.set(row.key, { 
        key: row.key, 
        name: row.name, 
        brand: row.brand, 
        standard_brand: row.standard_brand,
        category: row.category,
        unit_base: row.unit_base, 
        unit_text: row.unit_text,
        standard_size: row.standard_size,
        countries: {} 
      });
    }
    
    map.get(row.key).countries[row.country] = {
      price_eur: row.price_eur,
      unit_price_eur: row.unit_price_eur,
      deposit_eur: row.deposit_eur,
      price_type: row.price_type,
      url: row.url,
      captured_at: row.captured_at
    };
  };
  
  [...hr, ...si, ...at, ...de].forEach(add);

  // Keep only products that exist in 2+ countries
  const out = [];
  for (const v of map.values()) {
    const countryCount = Object.keys(v.countries).length;
    if (countryCount >= 2) {
      out.push({
        ...v,
        country_count: countryCount
      });
    }
  }
  
  // Sort by country count (most matches first), then by name
  out.sort((a, b) => {
    if (b.country_count !== a.country_count) {
      return b.country_count - a.country_count;
    }
    return (a.name || "").localeCompare(b.name || "");
  });
  
  return out;
}