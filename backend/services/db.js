// backend/services/db.js
import "dotenv/config";
import pg from "pg";

export const pool = new pg.Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "postgres",
  password: String(process.env.PGPASSWORD ?? ""),
  database: process.env.PGDATABASE || "postgres",
  ssl:
    String(process.env.PGSSL || "").toLowerCase() === "true"
      ? { rejectUnauthorized: false }
      : false,
});

// Add these exports that your services expect
export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();

// ensure one Lidl store per country (DE/AT/SI/HR) exists
async function getOrCreateStoreId(client, countryCode) {
  const map = { de: "Germany", at: "Austria", si: "Slovenia", hr: "Hrvatska" };
  const country = map[countryCode] || countryCode.toUpperCase();
  const { rows: s1 } = await client.query(
    `SELECT id FROM stores WHERE name='Lidl' AND country=$1 LIMIT 1`,
    [country]
  );
  if (s1[0]) return s1[0].id;

  const { rows: s2 } = await client.query(
    `INSERT INTO stores(name, country, website_url) VALUES ('Lidl', $1, $2) RETURNING id`,
    [country, `https://www.lidl.${countryCode}`]
  );
  return s2[0].id;
}

export async function persistRows(countryCode, rows) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const storeId = await getOrCreateStoreId(client, countryCode);

    // start session in your schema
    const { rows: s } = await client.query(
      `INSERT INTO scraping_sessions (store_id, session_type, status, started_at)
       VALUES ($1, $2, $3, NOW()) RETURNING id`,
      [storeId, "manual", "running"]
    );
    const sessionId = s[0].id;

    let saved = 0;
    for (const r of rows) {
      // upsert product by (name, brand) — GTIN if present
      let productId;
      if (r.gtin) {
        const ex = await client.query(
          `SELECT id FROM products WHERE gtin = $1 LIMIT 1`,
          [r.gtin]
        );
        if (ex.rows[0]) {
          productId = ex.rows[0].id;
          await client.query(
            `UPDATE products SET name=$2, brand=$3, unit=$4, comparison_key=$5 WHERE id=$1`,
            [
              productId,
              r.name,
              r.brand || null,
              r.unit_base || r.unit_text || null,
              r.key,
            ]
          );
        } else {
          const ins = await client.query(
            `INSERT INTO products (gtin, name, brand, unit, comparison_key) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
            [
              r.gtin,
              r.name,
              r.brand || null,
              r.unit_base || r.unit_text || null,
              r.key,
            ]
          );
          productId = ins.rows[0].id;
        }
      } else {
        const ex = await client.query(
          `SELECT p.id
             FROM products p
             JOIN prices pr ON pr.product_id = p.id
             WHERE lower(p.name)=lower($1) AND coalesce(lower(p.brand),'') = coalesce(lower($2),'')
             LIMIT 1`,
          [r.name, r.brand || null]
        );
        if (ex.rows[0]) {
          productId = ex.rows[0].id;
          await client.query(`UPDATE products SET unit=$2 WHERE id=$1`, [
            productId,
            r.unit_base || r.unit_text || null,
          ]);
        } else {
          const ins = await client.query(
            `INSERT INTO products (name, brand, unit, comparison_key) VALUES ($1,$2,$3,$4) RETURNING id`,
            [r.name, r.brand || null, r.unit_base || r.unit_text || null, r.key]
          );
          productId = ins.rows[0].id;
        }
      }

      // insert price row
      await client.query(
        `INSERT INTO prices (product_id, store_id, price, currency, availability, scraped_at, note)
         VALUES ($1,$2,$3,'EUR', true, $4, $5)`,
        [productId, storeId, r.price_eur, r.captured_at, r.price_type]
      );
      saved++;
    }

    // complete session
    await client.query(
      `UPDATE scraping_sessions
          SET products_found=$1, status='completed', completed_at=NOW()
        WHERE id=$2`,
      [saved, sessionId]
    );

    await client.query("COMMIT");
    return { sessionId, inserted: saved };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
