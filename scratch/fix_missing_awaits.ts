import fs from 'fs';
import path from 'path';

const dirsToSearch = [
  path.join(process.cwd(), 'src/api/routes'),
  path.join(process.cwd(), 'src/db')
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace `db.get<{...}>(...)` with `await db.get<{...}>(...)` except if already using `await db.get`
  // We can just replace `db.get` with `await db.get` where it's not preceded by `await `
  content = content.replace(/(?<!await\s+)db\.get/g, 'await db.get');
  content = content.replace(/(?<!await\s+)db\.all/g, 'await db.all');
  content = content.replace(/(?<!await\s+)db\.run/g, 'await db.run');
  content = content.replace(/(?<!await\s+)db\.exec/g, 'await db.exec');

  fs.writeFileSync(filePath, content);
}

dirsToSearch.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'index.ts').forEach(file => {
    fixFile(path.join(dir, file));
  });
});
