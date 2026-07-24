import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const DATABASE_URL = process.env.DATABASE_URL ?? "./data/gezyteach.db";

const sqlite = new Database(DATABASE_URL, { create: true });
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./src/db/migrations" });

console.log(`Migrasi selesai. Database: ${DATABASE_URL}`);
sqlite.close();
