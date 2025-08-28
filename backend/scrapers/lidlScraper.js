// backend/scrapers/lidlScraper.js - Complete version with enhanced brand extraction
import { chromium } from "playwright";
import { gunzipSync } from 'zlib';

const COUNTRY_CFG = {
  hr: { 
    host: "https://www.lidl.hr",  
    sitemap: "/p/export/HR/hr/product_sitemap.xml.gz",
    fallbackPaths: ["/c/hrana-s7", "/c/pice-s13", "/c/mlijecni-proizvodi-s17"]
  },
  si: { 
    host: "https://www.lidl.si",  
    sitemap: "/p/export/SI/sl/product_sitemap.xml.gz",
    fallbackPaths: ["/c/zivila-s7", "/c/pijace-s13", "/c/mlecni-izdelki-s17"]
  },
  at: { 
    host: "https://www.lidl.at",  
    sitemap: "/p/export/AT/de/product_sitemap.xml.gz",
    fallbackPaths: ["/c/lebensmittel-s7", "/c/getraenke-s13", "/c/milchprodukte-s17"]
  },
  de: { 
    host: "https://www.lidl.de",  
    sitemap: "/p/export/DE/de/product_sitemap.xml.gz",
    fallbackPaths: ["/c/lebensmittel-s7", "/c/getraenke-s13", "/c/milchprodukte-s17"]
  },
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchGzippedSitemap(url) {
  try {
    const response = await fetch(url, { 
      headers: { 
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "accept": "application/xml, text/xml, */*",
        "accept-encoding": "gzip, deflate"
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    try {
      const decompressed = gunzipSync(buffer);
      return decompressed.toString('utf-8');
    } catch (gzipError) {
      return buffer.toString('utf-8');
    }
  } catch (error) {
    console.error(`Failed to fetch sitemap from ${url}:`, error.message);
    throw error;
  }
}

async function scrapeProductUrlsFromCategory(page, categoryUrl, limit = 50) {
  console.log(`Scraping product URLs from category: ${categoryUrl}`);
  
  try {
    await page.goto(categoryUrl, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const productUrls = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/p/"]'));
      return [...new Set(links.map(link => link.href))];
    });
    
    console.log(`Found ${productUrls.length} product URLs in category`);
    return productUrls.slice(0, limit);
    
  } catch (error) {
    console.error(`Failed to scrape category ${categoryUrl}:`, error.message);
    return [];
  }
}

function pickProductUrlsFromSitemap(xml, host, limit) {
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  
  while ((m = re.exec(xml))) {
    const url = m[1];
    if (url.includes('/p/') && url.startsWith(host)) {
      urls.push(url);
      if (urls.length >= limit) break;
    }
  }
  
  console.log(`Extracted ${urls.length} product URLs from sitemap`);
  return urls;
}

async function scrapeProduct(page, url, retryCount = 0) {
  const maxRetries = 2;
  
  try {
    await page.goto(url, { 
      waitUntil: "domcontentloaded",
      timeout: 10000 
    });
    
    await page.waitForTimeout(1500);
    
    const product = await page.evaluate(() => {
      function toNumber(s) {
        if (!s) return null;
        const cleaned = String(s)
          .replace(/[^\d,.-]/g, "")
          .replace(/,(\d{2})$/, '.$1')
          .replace(/,/g, '')
          .replace(/\.(\d)$/, '.$10');
        
        const num = parseFloat(cleaned);
        return Number.isFinite(num) && num > 0 ? num : null;
      }

      // Extract name first
      let name = null;
      const nameSelectors = [
        'h1',
        '[data-testid*="title"]',
        '.product-title',
        '.product-name',
        '[class*="title"]',
        '.keyfacts__title',
        '.m-product-details__title'
      ];
      
      for (const selector of nameSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent && el.textContent.trim()) {
          name = el.textContent.trim();
          break;
        }
      }

      // Enhanced brand extraction
      let brand = null;
      
      // Try JSON-LD structured data first
      const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const script of jsonLdScripts) {
        try {
          const data = JSON.parse(script.textContent);
          const items = Array.isArray(data) ? data : [data];
          
          for (const item of items) {
            if (item && item['@type'] === 'Product' && item.brand) {
              brand = typeof item.brand === 'string' ? item.brand : item.brand.name;
              if (brand) break;
            }
          }
          if (brand) break;
        } catch (e) {
          continue;
        }
      }
      
      // DOM-based brand extraction
      if (!brand) {
        const brandSelectors = [
          '[data-testid*="brand"]',
          '.brand',
          '.product-brand',
          '.manufacturer',
          '[class*="Brand"]',
          'span[class*="brand" i]',
          '.m-product-details__brand',
          '.keyfacts__brand'
        ];
        
        for (const selector of brandSelectors) {
          const brandEl = document.querySelector(selector);
          if (brandEl && brandEl.textContent && brandEl.textContent.trim()) {
            brand = brandEl.textContent.trim();
            break;
          }
        }
      }
      
      // Extract brand from product name as fallback
      if (!brand && name) {
        const knownBrands = [
          'Milbona', 'Kornmühle', 'Dulano', 'Bio', 'Freeway', 
          'Lupilu', 'Silvercrest', 'Parkside', 'Livarno',
          'Tower', 'Crivit', 'Pepperts', 'Esmara',
          'Florabest', 'Chef Select', 'Mcennedy'
        ];
        
        const nameLower = name.toLowerCase();
        for (const knownBrand of knownBrands) {
          if (nameLower.includes(knownBrand.toLowerCase())) {
            brand = knownBrand;
            break;
          }
        }
      }

      // Enhanced GTIN extraction
      let gtin = null;
      
      // Try JSON-LD for GTIN
      for (const script of jsonLdScripts) {
        try {
          const data = JSON.parse(script.textContent);
          const items = Array.isArray(data) ? data : [data];
          
          for (const item of items) {
            if (item && item['@type'] === 'Product') {
              gtin = item.gtin13 || item.gtin || item.sku || item.mpn;
              if (gtin) break;
            }
          }
          if (gtin) break;
        } catch (e) {
          continue;
        }
      }
      
      // DOM-based GTIN extraction
      if (!gtin) {
        const gtinSelectors = [
          '[data-testid*="sku"]',
          '[data-testid*="gtin"]',
          '.sku',
          '.gtin',
          '.product-code'
        ];
        
        for (const selector of gtinSelectors) {
          const gtinEl = document.querySelector(selector);
          if (gtinEl && gtinEl.textContent) {
            const gtinText = gtinEl.textContent.trim();
            // Validate GTIN format (8, 12, 13, or 14 digits)
            if (/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(gtinText)) {
              gtin = gtinText;
              break;
            }
          }
        }
      }

      // Comprehensive price extraction
      let price = null;
      
      // Try JSON-LD price first
      for (const script of jsonLdScripts) {
        try {
          const data = JSON.parse(script.textContent);
          const items = Array.isArray(data) ? data : [data];
          
          for (const item of items) {
            if (item && item['@type'] === 'Product' && item.offers) {
              const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              if (offer && offer.price) {
                price = toNumber(offer.price);
                if (price) break;
              }
            }
          }
          if (price) break;
        } catch (e) {
          continue;
        }
      }
      
      // DOM-based price extraction
      if (!price) {
        const priceSelectors = [
          '[data-testid*="price"]',
          '.price',
          '.m-price__price',
          '.product-price',
          '[class*="price"]',
          '.keyfacts__price',
          '.price-current',
          '.current-price',
          '[class*="Price"]'
        ];
        
        for (const selector of priceSelectors) {
          const priceEl = document.querySelector(selector);
          if (priceEl && priceEl.textContent) {
            price = toNumber(priceEl.textContent);
            if (price && price >= 0.10 && price <= 999.99) break;
          }
        }
      }
      
      // Text-based price extraction as final fallback
      if (!price) {
        const bodyText = document.body.textContent || "";
        const pricePatterns = [
          /(\d{1,3}[,.]\d{2})\s*€/g,
          /€\s*(\d{1,3}[,.]\d{2})/g,
          /(\d{1,3}[,.]\d{2})\s*EUR/gi
        ];
        
        for (const pattern of pricePatterns) {
          const matches = Array.from(bodyText.matchAll(pattern));
          if (matches.length > 0) {
            for (const match of matches) {
              const candidate = toNumber(match[1]);
              if (candidate && candidate >= 0.10 && candidate <= 999.99) {
                price = candidate;
                break;
              }
            }
            if (price) break;
          }
        }
      }

      // Unit/size extraction
      let unit_text = "";
      const unitSelectors = [
        '[data-testid*="unit"]',
        '.unit',
        '.m-price__unit',
        '.product-unit',
        '[data-testid*="size"]',
        '.packaging-size',
        '.keyfacts__unit'
      ];
      
      for (const selector of unitSelectors) {
        const unitEl = document.querySelector(selector);
        if (unitEl && unitEl.textContent) {
          unit_text = unitEl.textContent.trim();
          if (unit_text) break;
        }
      }

      // Promotional flags detection
      const isLidlPlus = !!(
        document.querySelector('[alt*="Lidl Plus"], [class*="lidl-plus"], [data-testid*="lidl-plus"]') ||
        document.body.textContent?.includes('Lidl Plus')
      );
      
      const isPromo = !!(
        document.querySelector('[class*="promo"], [class*="offer"], [class*="badge"], [data-testid*="promo"]') ||
        document.body.textContent?.match(/angebot|promo|sale|akcija|popust/i)
      );

      // Deposit detection
      let deposit = null;
      const allText = document.body.textContent || "";
      const pfandMatch = allText.match(/pfand[:\s]*(\d+[.,]?\d*)\s*(€|eur|cent)/i);
      if (pfandMatch) {
        deposit = toNumber(pfandMatch[1]);
        if (/cent/i.test(pfandMatch[2]) && deposit !== null && deposit < 5) {
          deposit = deposit / 100;
        }
      }

      console.log(`Extracted: name="${name}", brand="${brand}", gtin="${gtin}", price=${price}`);

      return {
        url: location.href,
        name: name || null,
        brand: brand || null,
        gtin: gtin || null,
        price: price,
        unit_text: unit_text || null,
        isLidlPlus,
        isPromo,
        deposit
      };
    });

    // Validation - require at least name and price
    if (!product.name && !product.price) {
      throw new Error(`No usable product data found`);
    }
    
    if (!product.price) {
      throw new Error(`No price found for "${product.name}"`);
    }

    return product;

  } catch (error) {
    if (retryCount < maxRetries) {
      console.log(`Retrying ${url} (${retryCount + 1}/${maxRetries + 1})`);
      await sleep(1000);
      return scrapeProduct(page, url, retryCount + 1);
    }
    throw error;
  }
}

export async function scrapeCountry(country, { limit = 50 } = {}) {
  if (!COUNTRY_CFG[country]) {
    throw new Error(`Unsupported country: ${country}`);
  }
  
  const { host, sitemap, fallbackPaths } = COUNTRY_CFG[country];
  console.log(`Starting scrape for ${country.toUpperCase()}`);

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  let productUrls = [];

  // Try sitemap first
  try {
    console.log(`Fetching sitemap from ${host + sitemap}`);
    const xml = await fetchGzippedSitemap(host + sitemap);
    productUrls = pickProductUrlsFromSitemap(xml, host, limit);
  } catch (sitemapError) {
    console.log(`Sitemap failed: ${sitemapError.message}`);
    console.log('Falling back to category scraping...');
    
    // Fallback: scrape category pages
    for (const categoryPath of fallbackPaths) {
      try {
        const categoryUrls = await scrapeProductUrlsFromCategory(
          page, 
          host + categoryPath, 
          Math.ceil(limit / fallbackPaths.length)
        );
        productUrls.push(...categoryUrls);
        
        if (productUrls.length >= limit) break;
        await sleep(1000);
      } catch (categoryError) {
        console.log(`Category ${categoryPath} failed: ${categoryError.message}`);
        continue;
      }
    }
  }

  if (productUrls.length === 0) {
    await browser.close();
    throw new Error(`No product URLs found for ${country}`);
  }

  console.log(`Scraping ${Math.min(productUrls.length, limit)} products...`);
  
  const results = [];
  const errors = [];

  for (let i = 0; i < Math.min(productUrls.length, limit); i++) {
    const url = productUrls[i];
    
    try {
      const product = await scrapeProduct(page, url);
      results.push({ country, ...product });
      
      if ((i + 1) % 5 === 0) {
        console.log(`Progress: ${i + 1}/${Math.min(productUrls.length, limit)} - ${results.length} products extracted`);
        console.log(`Brands found so far: ${[...new Set(results.filter(r => r.brand).map(r => r.brand))].join(', ')}`);
      }
      
      await sleep(200);
      
    } catch (error) {
      errors.push({ url, error: error.message });
      if (errors.length <= 3) {
        console.log(`Failed: ${url} - ${error.message}`);
      }
    }
  }

  await browser.close();
  
  console.log(`Completed ${country.toUpperCase()}: ${results.length} products, ${errors.length} errors`);
  console.log(`Brands extracted: ${[...new Set(results.filter(r => r.brand).map(r => r.brand))].sort().join(', ')}`);
  console.log(`Products with GTINs: ${results.filter(r => r.gtin).length}`);
  
  if (results.length === 0) {
    throw new Error(`No valid products extracted for ${country}. First 3 errors: ${errors.slice(0, 3).map(e => e.error).join('; ')}`);
  }

  return results;
}