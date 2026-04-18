import { initDatabase } from './apps/local/src/db/index.js';

async function run() {
    await initDatabase();
    console.log("DB sync finished.");
    process.exit(0);
}

run();
