import { Hono } from "hono";
import { cors } from "hono/cors";
import { asc, eq } from "drizzle-orm";
import {
  sessions,
  thoughts,
  sessionDetailSchema,
  createThoughtInputSchema,
  updateThoughtInputSchema,
  thoughtDtoSchema,
} from "@mindnotes/schema";
import { db } from "./db";
import { env } from "./env";
import { serializeSession, serializeThought } from "./serialize";

const app = new Hono();

app.use(
  "/*",
  cors({
    origin: env.WEB_ORIGIN,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

// GET /sessions/:id → { session, thoughts (по created_at asc) }
app.get("/sessions/:id", async (c) => {
  const id = c.req.param("id");

  const [session] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!session) {
    return c.json({ error: "session_not_found" }, 404);
  }

  const rows = await db
    .select()
    .from(thoughts)
    .where(eq(thoughts.sessionId, id))
    .orderBy(asc(thoughts.createdAt));

  // Валідуємо відповідь спільною zod-схемою перед віддачею.
  const payload = sessionDetailSchema.parse({
    session: serializeSession(session),
    thoughts: rows.map(serializeThought),
  });

  return c.json(payload);
});

// POST /sessions/:id/thoughts → створює думку, повертає її (created_at asc у кінці потоку)
app.post("/sessions/:id/thoughts", async (c) => {
  const id = c.req.param("id");

  const json = await c.req.json().catch(() => null);
  const parsed = createThoughtInputSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const [session] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!session) {
    return c.json({ error: "session_not_found" }, 404);
  }

  const [row] = await db
    .insert(thoughts)
    .values({ sessionId: id, body: parsed.data.body })
    .returning();

  const payload = thoughtDtoSchema.parse(serializeThought(row!));
  return c.json(payload, 201);
});

// PATCH /thoughts/:id → архівувати/розархівувати, повертає оновлену думку
app.patch("/thoughts/:id", async (c) => {
  const id = c.req.param("id");

  const json = await c.req.json().catch(() => null);
  const parsed = updateThoughtInputSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const [row] = await db
    .update(thoughts)
    .set({ archived: parsed.data.archived })
    .where(eq(thoughts.id, id))
    .returning();

  if (!row) {
    return c.json({ error: "thought_not_found" }, 404);
  }

  const payload = thoughtDtoSchema.parse(serializeThought(row));
  return c.json(payload);
});

export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.log(`🟢 api на http://localhost:${env.PORT}`);
