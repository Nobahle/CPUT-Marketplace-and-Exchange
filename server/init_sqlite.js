import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDb() {
  const dbPath = path.join(__dirname, 'db/cput.db');
  const schemaPath = path.join(__dirname, 'db/schema_sqlite.sql');
  
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  
  console.log('Initializing database...');
  await db.exec(schema);
  console.log('Database initialized successfully.');
  await db.close();
}

initDb().catch(console.error);
