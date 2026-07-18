import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // --- Idempotency: only seed if empty ---
  const { rows: userRows } = await pool.query(`SELECT COUNT(*)::int AS n FROM users`);
  if (userRows[0].n > 0) {
    console.log("Database already seeded (users exist). Skipping.");
    return;
  }

  // --- Users (bcrypt) ---
  const adminHash = await bcrypt.hash("admin", 10);
  const cashierHash = await bcrypt.hash("cashier", 10);
  await pool.query(
    `INSERT INTO users (username, password_hash, first_name, last_name, role, active, updated_at)
     VALUES ($1,$2,'Store','Admin','ADMIN',true,now()), ($3,$4,'Front','Desk','CASHIER',true,now())`,
    ["admin", adminHash, "cashier", cashierHash]
  );

  // --- Store settings (single row) ---
  await pool.query(
    `INSERT INTO store_settings
       (id, store_name, tagline, address1, address2, tin, phone, email, website,
        business_reg, receipt_footer, invoice_prefix, default_vat_rate, vat_inclusive,
        repair_weekday_open, repair_weekday_close, repair_weekend_open, repair_weekend_close, repair_hourly_rate)
     VALUES (1,'Keidence Bike Shop','Bikes • Parts • Hobbies','123 Rizal Avenue','Quezon City, Metro Manila',
        '000-000-000-000','(02) 8000-0000','hello@keidence.ph','www.keidence.ph','',
        'Thank you for shopping with Keidence!','KEI',12,true,10,19,10,19,150)`
  );

  // --- Categories ---
  const categories = [
    ["Drivetrain", "DRV"], ["Tires", "TIR"], ["Accessories", "ACC"],
    ["Components", "CMP"], ["Care", "CAR"], ["RC Kits", "RCK"],
    ["Model Kits", "MDL"], ["Paint", "PNT"], ["Tools", "TOL"], ["RC Parts", "RCP"],
  ];
  const catIdByName = {};
  for (const [name, prefix] of categories) {
    const { rows } = await pool.query(
      `INSERT INTO categories (name, prefix) VALUES ($1,$2) RETURNING id`,
      [name, prefix]
    );
    catIdByName[name] = rows[0].id;
  }

  // --- Products (+ matching templates) ---
  const products = [
    ["Shimano Deore XT Rear Derailleur", "Drivetrain", "4550170123456", "12-speed rear derailleur", 4200, 6500, 8, 3],
    ["Continental GP5000 Tire 700x25", "Tires", "4019238012345", "Clincher road tire", 1800, 2950, 24, 10],
    ["Maxxis Minion DHF 29x2.5", "Tires", "4717784021102", "MTB front tire", 1650, 2700, 5, 6],
    ["SRAM PC-1110 Chain 11sp", "Drivetrain", "710845778001", "11-speed chain", 950, 1650, 30, 8],
    ["Bontrager Aeolus Helmet M", "Accessories", "601842567890", "Road helmet, medium", 3200, 5200, 12, 4],
    ["Fizik Antares Saddle", "Components", "8021890412345", "Road saddle", 2400, 3900, 2, 3],
    ["Muc-Off Bike Cleaner 1L", "Care", "5037835904048", "Biodegradable cleaner", 320, 590, 40, 12],
    ["CatEye Volt 800 Headlight", "Accessories", "4990173028931", "USB rechargeable light", 2100, 3450, 9, 4],
    ["Tamiya TT-02 Chassis Kit", "RC Kits", "4950344583850", "1/10 RC touring car kit", 3600, 5400, 6, 3],
    ["Gunpla RG Nu Gundam", "Model Kits", "4573102621009", "Real Grade 1/144", 1900, 3200, 14, 5],
    ["Tamiya Acrylic Paint X-1 Black", "Paint", "4950344810000", "10ml acrylic", 55, 110, 60, 20],
    ["Mr. Hobby Cement 40ml", "Tools", "4973028500011", "Plastic model cement", 120, 230, 3, 8],
    ["Traxxas 2S LiPo Battery 5800mAh", "RC Parts", "020334029805", "7.4V LiPo pack", 1400, 2350, 10, 4],
    ["God Hand Nipper SPN-120", "Tools", "4562113642189", "Ultra-thin single blade nipper", 1600, 2600, 4, 3],
  ];

  for (const [name, cat, barcode, desc, cost, price, qty, reorder] of products) {
    // Template first
    const { rows: t } = await pool.query(
      `INSERT INTO product_templates (name, category_id, code, default_cost_price, default_unit_price)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [name, catIdByName[cat], barcode, cost, price]
    );
    const templateId = t[0].id;
    const { rows: p } = await pool.query(
      `INSERT INTO products (name, category, barcode, description, cost_price, unit_price, stock_quantity, reorder_level, deleted, template_id, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9,now()) RETURNING id`,
      [name, cat, barcode, desc, cost, price, qty, reorder, templateId]
    );
    // Opening-stock ledger row
    await pool.query(
      `INSERT INTO inventory_transactions (product_id, user_id, reason, quantity_change, comment)
       VALUES ($1, 1, 'INITIAL', $2, 'Opening stock')`,
      [p[0].id, qty]
    );
  }

  console.log("Seed complete: 2 users, 10 categories, 14 products + templates, settings.");
}

main()
  .catch((e) => { console.error("Seed failed:", e.message); process.exitCode = 1; })
  .finally(async () => { await pool.end(); });
