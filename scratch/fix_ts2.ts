import fs from 'fs';
import path from 'path';

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  content = content.replace(/(?<!await\s+)db\.get/g, 'await db.get');
  content = content.replace(/(?<!await\s+)db\.all/g, 'await db.all');
  content = content.replace(/(?<!await\s+)db\.run/g, 'await db.run');
  content = content.replace(/(?<!await\s+)db\.exec/g, 'await db.exec');

  // Fix where I double awaited
  content = content.replace(/await\s+await\s+/g, 'await ');

  // Fix return type of entries.ts
  // entries.ts(11,52) function getOrCreateVehicle(patent: string): Vehicle {
  content = content.replace(/function\s+getOrCreateVehicle\s*\(\s*patent:\s*string\s*\)\s*:\s*Vehicle\s*\{/g, 'async function getOrCreateVehicle(patent: string): Promise<Vehicle> {');
  // entries.ts(61,31) const vehicle = getOrCreateVehicle(normalizedPatent);
  content = content.replace(/const\s+vehicle\s*=\s*getOrCreateVehicle/g, 'const vehicle = await getOrCreateVehicle');

  // Fix return type of memberships.ts function getOrCreateOwner
  content = content.replace(/function\s+getOrCreateOwner/g, 'async function getOrCreateOwner');
  content = content.replace(/const\s+owner\s*=\s*getOrCreateOwner/g, 'const owner = await getOrCreateOwner');

  // Fix sync.ts function addToSyncLog
  content = content.replace(/function\s+addToSyncLog/g, 'async function addToSyncLog');
  content = content.replace(/addToSyncLog\(/g, 'await addToSyncLog(');
  content = content.replace(/async\s+async/g, 'async');
  content = content.replace(/await\s+await/g, 'await');

  // Fix property accesses
  content = content.replace(/\)\.value/g, ')?.value');
  content = content.replace(/\?\?\.value/g, '?.value');

  fs.writeFileSync(filePath, content);
}

const dirsToSearch = [
  path.join(process.cwd(), 'src/api/routes'),
  path.join(process.cwd(), 'src/db')
];

dirsToSearch.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'shared.ts').forEach(file => {
    fixFile(path.join(dir, file));
  });
});
