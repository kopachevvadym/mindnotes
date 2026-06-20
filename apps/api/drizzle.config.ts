import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Єдиний .env лежить у корені монорепо.
config({ path: "../../.env", quiet: true });

export default defineConfig({
  schema: "../../packages/schema/src/tables.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
