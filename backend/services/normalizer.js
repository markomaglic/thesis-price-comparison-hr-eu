// backend/services/normalizer.js - Fixed version with proper semantic matching priority
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
  if (unit === "g") return { qty: val, base: val / 1000, baseUnit: "kg" };
  if (unit === "l") return { qty: val, base: val, baseUnit: "l" };
  if (unit === "ml") return { qty: val, base: val / 1000, baseUnit: "l" };
  return { qty: val, base: null, baseUnit: null };
}

// Extract and standardize brand names for better matching
function standardizeBrand(brand) {
  if (!brand) return null;

  // Convert to lowercase and remove common variations
  return brand
    .toLowerCase()
    .replace(/\s+/g, "") // Remove spaces
    .replace(/[®™©]/g, "") // Remove trademark symbols
    .trim();
}

// Cross-language product type detection - EXPANDED
function getProductTypeKey(name, brand) {
  if (!name) return null;

  const nameLower = name.toLowerCase();

  // Milk products (multilingual) - MOST IMPORTANT
  if (/milk|milch|mlijeko|mleko|latte|leche|mliecko/.test(nameLower)) {
    if (/fresh|frisch|svjez|sveže|fresco|svježe/.test(nameLower)) {
      // Add svježe
      return "fresh-milk";
    }
    return "milk";
  }

  // Cheese products
  if (/cheese|käse|sir|queso|fromage|syr/.test(nameLower)) {
    if (/cream|frischkäse|krem|namaz/.test(nameLower)) {
      return "cream-cheese";
    }
    if (/cottage|zrnati|granular/.test(nameLower)) {
      return "cottage-cheese";
    }
    return "cheese";
  }

  // Candy/Sweets
  if (/bonbon|gumeni|gummy|candy|sweets|süß|bombon/.test(nameLower)) {
    return "candy";
  }

  // Yogurt products
  if (/yogurt|joghurt|jogurt|yaourt|yogur/.test(nameLower)) {
    return "yogurt";
  }

  // Butter products
  if (/butter|maslo|mantequilla|beurre/.test(nameLower)) {
    return "butter";
  }

  // Water products
  if (/water|wasser|voda|agua|eau/.test(nameLower)) {
    if (/mineral|mineralna/.test(nameLower)) {
      return "mineral-water";
    }
    return "water";
  }

  // Cola/Soft drinks
  if (/cola|coke|pepsi|soda/.test(nameLower)) {
    return "cola";
  }

  // Bread products
  if (/bread|brot|kruh|pecivo|pan|chléb/.test(nameLower)) {
    return "bread";
  }

  // Desserts/Puddings
  if (/pudding|desert|dessert|mousse/.test(nameLower)) {
    return "dessert";
  }

  // Juice products
  if (/juice|saft|sok|zumo|jus/.test(nameLower)) {
    if (/orange|naranča|apfelsine/.test(nameLower)) {
      return "orange-juice";
    }
    if (/apple|jabuka|apfel/.test(nameLower)) {
      return "apple-juice";
    }
    return "juice";
  }

  // Beer products
  if (/beer|bier|pivo|cerveza|bière/.test(nameLower)) {
    return "beer";
  }

  return null;
}

// Create product category from name for additional matching
function getProductCategory(name) {
  if (!name) return "other";

  const nameLower = name.toLowerCase();

  // Dairy products
  if (
    /milch|mlijeko|mleko|milk|jogurt|joghurt|yogurt|sir|käse|cheese|butter|maslo|cream/.test(
      nameLower
    )
  ) {
    return "dairy";
  }

  // Bread and bakery
  if (/brot|kruh|bread|pecivo|cake|kuchen|donut/.test(nameLower)) {
    return "bakery";
  }

  // Meat products
  if (
    /fleisch|meso|meat|wurst|kobasica|chicken|piletina|beef|govedina/.test(
      nameLower
    )
  ) {
    return "meat";
  }

  // Fruits and vegetables
  if (
    /fruit|voće|obst|banana|apple|jabuka|orange|naranča|potato|krumpir/.test(
      nameLower
    )
  ) {
    return "produce";
  }

  // Beverages
  if (
    /getränk|piće|drink|water|voda|juice|sok|beer|pivo|cola/.test(nameLower)
  ) {
    return "beverages";
  }

  // Candy/Sweets
  if (/bonbon|gumeni|candy|sweets|süß/.test(nameLower)) {
    return "sweets";
  }

  return "other";
}

// Round base quantities to standard sizes for better matching
function standardizeSize(base, baseUnit) {
  if (!base || !baseUnit) return null;

  // Round to common package sizes
  const commonSizes = {
    l: [0.25, 0.33, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0],
    kg: [0.1, 0.2, 0.25, 0.5, 1.0, 1.5, 2.0, 2.5, 5.0],
  };

  const sizes = commonSizes[baseUnit] || [];

  // Find closest common size
  let closest = base;
  let minDiff = Infinity;

  for (const size of sizes) {
    const diff = Math.abs(base - size);
    if (diff < minDiff && diff < base * 0.15) {
      // Within 15% tolerance
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
  const productType = getProductTypeKey(r.name, r.brand);

  const priceType = r.isLidlPlus
    ? "lidl_plus"
    : r.isPromo
    ? "promo"
    : "regular";

  // FIXED: Enhanced key generation - prioritize semantic matching over GTIN
  let key;

  console.log(
    `Product: ${r.name}, Brand: ${standardBrand}, Type: ${productType}, Size: ${standardSize}${baseUnit}, GTIN: ${r.gtin}`
  );

  if (standardBrand && productType && standardSize && baseUnit) {
    // PRIORITY 1: Use brand+product type+size for semantic matching (overrides GTIN)
    key = `type-${standardBrand}-${productType}-${standardSize}${baseUnit}`;
    console.log(`Using semantic key: ${key}`);
  } else if (standardBrand && productType) {
    // PRIORITY 2: Brand + product type matching (for products without clear sizes)
    key = `type-${standardBrand}-${productType}`;
    console.log(`Using brand+type key: ${key}`);
  } else if (r.gtin) {
    // PRIORITY 3: Fallback to GTIN only if semantic matching fails
    key = `gtin-${r.gtin}`;
    console.log(`Using GTIN key: ${key}`);
  } else if (standardBrand && standardSize && baseUnit) {
    // PRIORITY 4: Original brand + size + category matching
    key = `brand-${standardBrand}-${standardSize}${baseUnit}-${category}`;
    console.log(`Using brand+size key: ${key}`);
  } else if (standardBrand && category) {
    // PRIORITY 5: Brand + category matching
    key = `brand-${standardBrand}-${category}`;
    console.log(`Using brand+category key: ${key}`);
  } else {
    // PRIORITY 6: Last resort: Hash of name
    key = crypto
      .createHash("sha1")
      .update(`${(r.name || "").trim()}`)
      .digest("hex");
    console.log(`Using fallback hash key: ${key}`);
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
    standard_size: standardSize,
    product_type: productType,
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
        product_type: row.product_type,
        unit_base: row.unit_base,
        unit_text: row.unit_text,
        standard_size: row.standard_size,
        countries: {},
      });
    }

    map.get(row.key).countries[row.country] = {
      price_eur: row.price_eur,
      unit_price_eur: row.unit_price_eur,
      deposit_eur: row.deposit_eur,
      price_type: row.price_type,
      url: row.url,
      captured_at: row.captured_at,
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
        country_count: countryCount,
      });
    }
  }

  // Sort by match quality and country count
  out.sort((a, b) => {
    // First, prefer products with more countries
    if (b.country_count !== a.country_count) {
      return b.country_count - a.country_count;
    }

    // Then prefer better match types
    const getMatchPriority = (key) => {
      if (key.startsWith("type-")) return 4; // Semantic matching highest
      if (key.startsWith("gtin-")) return 3; // GTIN second
      if (key.startsWith("brand-")) return 2; // Brand matching third
      return 1; // Fallback lowest
    };

    const priorityDiff = getMatchPriority(b.key) - getMatchPriority(a.key);
    if (priorityDiff !== 0) return priorityDiff;

    // Finally sort by name
    return (a.name || "").localeCompare(b.name || "");
  });

  return out;
}

// Export helper functions for debugging
export { standardizeBrand, getProductTypeKey, parseNetContent };
