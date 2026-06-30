import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Єдиний .env лежить у корені монорепо.
config({ path: "../../.env", quiet: true });

export default defineConfig({
  schema: "../../packages/schema/src/tables.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: `file:${process.env.DATABASE_URL ?? "mindnotes.db"}`,
  },
});
