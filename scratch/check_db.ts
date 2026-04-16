import { getDatabase } from './apps/local/src/db/index';

try {
  const db = getDatabase();
  const info = db.all("PRAGMA table_info(monthly_memberships)");
  console.log("Table Info:", JSON.stringify(info, null, 2));

  const rows = db.all("SELECT * FROM monthly_memberships LIMIT 5");
  console.log("Sample Rows:", JSON.stringify(rows, null, 2));
} catch (err) {
  console.error("Error checking DB:", err);
}
