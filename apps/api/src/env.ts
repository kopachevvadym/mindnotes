import { config } from "dotenv";
import { z } from "zod";

// Завантажуємо єдиний .env з кореня монорепо (cwd скриптів = apps/api).
config({ path: "../../.env", quiet: true });

const envSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().default(3000),
  WEB_ORIGIN: z.url().default("http://localhost:5173"),
});

export const env = envSchema.parse(process.env);
