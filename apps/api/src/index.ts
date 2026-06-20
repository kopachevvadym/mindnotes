import { Hono } from "hono";
import { cors } from "hono/cors";
import { asc, count, desc, eq } from "drizzle-orm";
import {
  sessions,
  thoughts,
  sessionDtoSchema,
  sessionDetailSchema,
  sessionListSchema,
  createThoughtInputSchema,
  updateThoughtInputSchema,
  updateSessionInputSchema,
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

// GET /sessions → список сесій з кількістю думок, найновіші зверху
app.get("/sessions", async (c) => {
  const rows = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      createdAt: sessions.createdAt,
      thoughtCount: count(thoughts.id),
    })
    .from(sessions)
    .leftJoin(thoughts, eq(thoughts.sessionId, sessions.id))
    .groupBy(sessions.id)
    .orderBy(desc(sessions.createdAt));

  const payload = sessionListSchema.parse(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt.toISOString(),
      thoughtCount: r.thoughtCount,
    })),
  );

  return c.json(payload);
});

// POST /sessions → створює сесію без назви, повертає її
app.post("/sessions", async (c) => {
  const [row] = await db.insert(sessions).values({}).returning();
  const payload = sessionDtoSchema.parse(serializeSession(row!));
  return c.json(payload, 201);
});

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

// PATCH /sessions/:id → перейменування (title може бути null), повертає оновлену
app.patch("/sessions/:id", async (c) => {
  const id = c.req.param("id");

  const json = await c.req.json().catch(() => null);
  const parsed = updateSessionInputSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const [row] = await db
    .update(sessions)
    .set({ title: parsed.data.title })
    .where(eq(sessions.id, id))
    .returning();

  if (!row) {
    return c.json({ error: "session_not_found" }, 404);
  }

  const payload = sessionDtoSchema.parse(serializeSession(row));
  return c.json(payload);
});

// DELETE /sessions/:id → видаляє сесію (думки прибирає cascade)
app.delete("/sessions/:id", async (c) => {
  const id = c.req.param("id");

  const [row] = await db.delete(sessions).where(eq(sessions.id, id)).returning();
  if (!row) {
    return c.json({ error: "session_not_found" }, 404);
  }

  return c.body(null, 204);
});

export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.log(`🟢 api на http://localhost:${env.PORT}`);
