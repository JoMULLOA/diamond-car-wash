import { db, initDatabase, closeDatabase } from './index.js';
import fs from 'fs';
import path from 'path';

async function run() {
  await initDatabase();
  const sql = fs.readFileSync(path.join(process.cwd(), 'apps', 'local', 'src', 'db', 'migrations', '006_booking_payments.sql'), 'utf-8');
  const stmts = sql.split(';').filter(s => s.trim().length > 0);
  for (const stmt of stmts) {
    try {
      await db.run(stmt);
      console.log('Executed:', stmt);
    } catch (err: any) {
      console.log('Skipped/Errored:', err.message || String(err));
    }
  }
  closeDatabase();
}
run();
