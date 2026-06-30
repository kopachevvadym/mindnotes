import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "@mindnotes/schema";
import { env } from "./env";

// Локальний SQLite-файл (env.DATABASE_URL — шлях відносно cwd = apps/api).
const sqlite = new Database(env.DATABASE_URL);
// FK-каскад працює лише з увімкненим прагмою; persistent-конекшн її тримає.
sqlite.exec("PRAGMA foreign_keys = ON;");
sqlite.exec("PRAGMA journal_mode = WAL;");

export const db = drizzle(sqlite, { schema });
