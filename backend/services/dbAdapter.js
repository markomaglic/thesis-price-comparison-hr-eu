import { pool } from "./db.js";

// persistRows(country, rows) = from my previous message
export { persistRows } from "./db.js";

const codeToName = {
      de: "germany",
      at: "austria",
      si: "slovenia",
      hr: "hrvatska",
    };

function countryAliases(input) {
      if (!input) return [];
      const c = String(input).toLowerCase();
      const name = codeToName[c] || c;
      return [name]; // we store full names in stores.country
}

export async function getLatestByCountry(country) {
  const client = await pool.connect();
  try {
    const c = String(country || "").toLowerCase();

    // map code <-> stored country name
    const codeToName = {
      de: "germany",
      at: "austria",
      si: "slovenia",
      hr: "hrvatska",
    };
    const nameToCode = {
      germany: "de",
      austria: "at",
      slovenia: "si",
      hrvatska: "hr",
    };

    // build a small alias set so both forms match
    const aliases = new Set([c]);
    if (codeToName[c]) aliases.add(codeToName[c]); // "de" -> "germany"
    if (nameToCode[c]) aliases.add(nameToCode[c]); // "germany" -> "de"

    // Postgres: = ANY($1) with a text[] param
    const params = [Array.from(aliases)];

    const { rows } = await client.query(
      `
      WITH latest AS (
        SELECT pr.product_id, pr.price, pr.currency, pr.scraped_at,
               ROW_NUMBER() OVER (
                 PARTITION BY pr.product_id, pr.store_id
                 ORDER BY pr.scraped_at DESC
               ) rn
          FROM prices pr
          JOIN stores s ON s.id = pr.store_id
         WHERE LOWER(s.country) = ANY ($1)
      )
      SELECT p.name, p.brand, p.unit, l.price, l.currency, l.scraped_at
        FROM latest l
        JOIN products p ON p.id = l.product_id
       WHERE l.rn = 1
       ORDER BY p.name
      `,
      params
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function getCompareView() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      WITH latest AS (
        SELECT pr.product_id, pr.price, pr.scraped_at, pr.store_id,
               ROW_NUMBER() OVER (PARTITION BY pr.product_id, pr.store_id ORDER BY pr.scraped_at DESC) rn
          FROM prices pr
      )
      SELECT 
        s.country, p.name, p.brand, p.unit, l.price, l.scraped_at,
        p.comparison_key as compare_key
        FROM latest l
        JOIN products p ON p.id = l.product_id
        JOIN stores s   ON s.id = l.store_id
       WHERE l.rn = 1
      ORDER BY p.comparison_key, s.country
    `);

    return rows;
  } finally {
    client.release();
  }
}

export async function generateSyntheticHistory(monthsBack = 12) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // latest price per (product, store)
    const { rows: latest } = await client.query(`
      WITH r AS (
        SELECT product_id, store_id, price, COALESCE(currency,'EUR') AS currency,
               ROW_NUMBER() OVER (PARTITION BY product_id, store_id ORDER BY scraped_at DESC) rn
        FROM prices
      )
      SELECT product_id, store_id, price, currency
      FROM r WHERE rn = 1
    `);

    let inserted = 0;
    for (const row of latest) {
      for (let m = 1; m <= Number(monthsBack); m++) {
        const dt = new Date();
        dt.setUTCDate(15);
        dt.setUTCHours(12, 0, 0, 0);
        dt.setUTCMonth(dt.getUTCMonth() - m);

        const month = dt.getUTCMonth() + 1;
        const seasonal = 1 + 0.12 * Math.sin((2 * Math.PI * month) / 12);
        const noise = 1 + (Math.random() * 0.06 - 0.03);
        const price = Math.max(
          0.05,
          Math.round(row.price * seasonal * noise * 100) / 100
        );

        await client.query(
          `INSERT INTO prices (product_id, store_id, price, currency, availability, scraped_at, note)
           SELECT $1,$2,$3,$4,true,$5,'synthetic'
           WHERE NOT EXISTS (
             SELECT 1 FROM prices
              WHERE product_id=$1 AND store_id=$2
                AND date_trunc('month', scraped_at) = date_trunc('month',$5::timestamp)
           )`,
          [row.product_id, row.store_id, price, row.currency, dt.toISOString()]
        );
        inserted++;
      }
    }

    await client.query("COMMIT");
    return { insertedCount: inserted, productsProcessed: latest.length };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getPriceHistory(
  productName,
  country = null,
  monthsBack = 12
) {
  const client = await pool.connect();
  try {
    const aliases = countryAliases(country);
    const params = [productName, monthsBack];
    let whereCountry = "";
    if (aliases.length) {
      params.push(aliases);
      whereCountry = "AND LOWER(s.country) = ANY($3)";
    }

    const sql = `
      WITH prod AS (
        SELECT id FROM products WHERE LOWER(name) = LOWER($1) ORDER BY id LIMIT 1
      )
      SELECT date_trunc('day', p.scraped_at) AS date,
             MIN(p.price) AS price,                 -- collapse multiple rows/day
             COALESCE(p.currency, 'EUR') AS currency,
             s.country
        FROM prices p
        JOIN prod  ON p.product_id = prod.id
        JOIN stores s ON s.id = p.store_id
       WHERE p.scraped_at >= (NOW() - ($2 || ' months')::interval)
         ${whereCountry}
       GROUP BY 1,3,4
       ORDER BY 1 ASC;
    `;
    const { rows } = await client.query(sql, params);
    return rows;
  } finally {
    client.release();
  }
}

export async function getMonthlyAverages(monthsBack = 12) {
  const svc = (await import("../priceHistoryService.js")).default;
  return svc.getPriceComparisonOverTime(monthsBack);
}
