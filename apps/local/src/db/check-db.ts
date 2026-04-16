import { getDatabase, initDatabase } from './index.js';

async function check() {
  await initDatabase();
  const db = getDatabase();
  const rows = await db.all('SELECT * FROM settings');
  console.log(JSON.stringify(rows, null, 2));
}

check();
