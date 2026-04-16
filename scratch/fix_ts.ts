import fs from 'fs';
import path from 'path';

const routesDir = path.join(process.cwd(), 'src/api');
const routesSubDir = path.join(routesDir, 'routes');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix precedence of await with property access: await db.get(...)?.value -> (await db.get(...))?.value
  content = content.replace(/await\s+db\.get([^)]*\))\.value/g, '(await db.get$1)?.value');
  content = content.replace(/await\s+db\.get([^)]*\))\?\.value/g, '(await db.get$1)?.value');
  
  // Same for .count, .total, .transactions, .revenue, .entries, .synced_at
  content = content.replace(/await\s+db\.get([^)]*\))\.count/g, '(await db.get$1)?.count');
  content = content.replace(/await\s+db\.get([^)]*\))\?\.count/g, '(await db.get$1)?.count');
  
  content = content.replace(/await\s+db\.get([^)]*\))\.total/g, '(await db.get$1)?.total');
  content = content.replace(/await\s+db\.get([^)]*\))\.transactions/g, '(await db.get$1)?.transactions');
  content = content.replace(/await\s+db\.get([^)]*\))\.revenue/g, '(await db.get$1)?.revenue');
  content = content.replace(/await\s+db\.get([^)]*\))\.entries/g, '(await db.get$1)?.entries');
  content = content.replace(/await\s+db\.get([^)]*\))\.synced_at/g, '(await db.get$1)?.synced_at');

  content = content.replace(/await\s+db\.get([^)]*\))\?\.transactions/g, '(await db.get$1)?.transactions');
  content = content.replace(/await\s+db\.get([^)]*\))\?\.revenue/g, '(await db.get$1)?.revenue');
  content = content.replace(/await\s+db\.get([^)]*\))\?\.entries/g, '(await db.get$1)?.entries');

  // Fix .length on db.all
  content = content.replace(/await\s+db\.all([^)]*\))\.length/g, '(await db.all$1).length');
  content = content.replace(/await\s+db\.all([^)]*\))\.map/g, '(await db.all$1).map');
  content = content.replace(/await\s+db\.all([^)]*\))\.forEach/g, '(await db.all$1).forEach');

  // Fix synchronous helper functions in entries.ts, memberships.ts, sync.ts
  // function getOrCreateVehicle -> async function getOrCreateVehicle
  content = content.replace(/function\s+getOrCreateVehicle\s*\(/g, 'async function getOrCreateVehicle(');
  content = content.replace(/function\s+getOrCreateOwner\s*\(/g, 'async function getOrCreateOwner(');
  content = content.replace(/function\s+addToSyncLog\s*\(/g, 'async function addToSyncLog(');
  
  // db.transaction(() => { -> db.transaction(async () => {
  content = content.replace(/db\.transaction\(\s*\(\)\s*=>\s*\{/g, 'db.transaction(async () => {');

  // for (const [key, value] of Object.entries(updates))
  // wait, settings.ts iterates over Object.entries, that's fine.
  
  // Fix settings: for (const { key, value } of await db.all(...))
  content = content.replace(/for\s*\(\s*const\s+([^{]*)\s+of\s+await\s+db\.all/g, 'for (const $1 of await db.all');
  
  fs.writeFileSync(filePath, content);
}

// Process routes
fs.readdirSync(routesSubDir).filter(f => f.endsWith('.ts')).forEach(file => {
  fixFile(path.join(routesSubDir, file));
});

// Also fix db/migrate.ts and db/seed-settings.ts
const dbDir = path.join(process.cwd(), 'src/db');
if (fs.existsSync(path.join(dbDir, 'migrate.ts'))) fixFile(path.join(dbDir, 'migrate.ts'));
if (fs.existsSync(path.join(dbDir, 'seed-settings.ts'))) fixFile(path.join(dbDir, 'seed-settings.ts'));

