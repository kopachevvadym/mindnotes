import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./db";

// bun:sqlite синхронний — міграції застосовуються без await.
migrate(db, { migrationsFolder: "./drizzle" });
console.log("✅ Міграції застосовано");
