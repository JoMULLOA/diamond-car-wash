import fs from 'fs';
import path from 'path';

const routesDir = path.join(process.cwd(), 'src/api/routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Add async to router.get, router.post, router.put, router.delete if they don't have it
  content = content.replace(/router\.(get|post|put|delete)\('([^']+)',\s*\(([^)]*)\)\s*=>\s*\{/g, (match, method, path, args) => {
    return `router.${method}('${path}', async (${args}) => {`;
  });

  // 2. Change db.get, db.run, db.all to await db.get, etc.
  content = content.replace(/db\.get([<A-Za-z0-9_>]*)\(/g, 'await db.get$1(');
  content = content.replace(/db\.run\(/g, 'await db.run(');
  content = content.replace(/db\.all([<A-Za-z0-9_>]*)\(/g, 'await db.all$1(');
  content = content.replace(/db\.exec\(/g, 'await db.exec(');

  // Fix some nested awaits if they were already there but rare
  content = content.replace(/await\s+await\s+db/g, 'await db');

  // Fix places where db returns values used without async wrapper (e.g. inside a map or forEach)
  // E.g. .map(b => db.all(...)) -> .map(async b => await db.all(...)) and Promise.all
  // We'll have to manually review those or fix them generically if we can.
  
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
});
