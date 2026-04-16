import { db, initDatabase } from './index';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
  await initDatabase();
  
  const migrationsDir = path.join(__dirname, './migrations');
  
  // Ensure migrations table exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    )
  `);

  // Get list of applied migrations
  const applied = await db.all<{ name: string }>('SELECT name FROM _migrations');
  const appliedNames = new Set(applied.map(m => m.name));

  // Get migration files
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Apply pending migrations
  for (const file of files) {
    if (!appliedNames.has(file)) {
      console.log(`[Migration] Applying: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      
      db.transaction(async () => {
        await db.exec(sql);
        await db.run('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', [file, Date.now()]);
      });
      
      console.log(`[Migration] Applied: ${file}`);
    }
  }

  console.log('[Migration] All migrations complete');
}

// Run automatically
runMigrations()
  .then(() => {
    console.log('[Migration] Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Migration] Error:', err);
    process.exit(1);
  });
