import { Hono } from "hono";
import { cors } from "hono/cors";
import { and, asc, count, desc, eq } from "drizzle-orm";
import {
  sessions,
  thoughts,
  contexts,
  thoughtContexts,
  sessionDtoSchema,
  sessionDetailSchema,
  sessionListSchema,
  contextDtoSchema,
  contextListSchema,
  createThoughtInputSchema,
  updateThoughtInputSchema,
  updateSessionInputSchema,
  createContextInputSchema,
  assignThoughtsInputSchema,
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

  // Контексти думок цієї сесії → мапа thoughtId → contextIds[].
  const links = await db
    .select({ thoughtId: thoughtContexts.thoughtId, contextId: thoughtContexts.contextId })
    .from(thoughtContexts)
    .innerJoin(thoughts, eq(thoughts.id, thoughtContexts.thoughtId))
    .where(eq(thoughts.sessionId, id));

  const contextIdsByThought = new Map<string, string[]>();
  for (const link of links) {
    const list = contextIdsByThought.get(link.thoughtId) ?? [];
    list.push(link.contextId);
    contextIdsByThought.set(link.thoughtId, list);
  }

  // Валідуємо відповідь спільною zod-схемою перед віддачею.
  const payload = sessionDetailSchema.parse({
    session: serializeSession(session),
    thoughts: rows.map((row) => ({
      ...serializeThought(row),
      contextIds: contextIdsByThought.get(row.id) ?? [],
    })),
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

// GET /contexts → глобальний список контекстів (для пошуку/пікера)
app.get("/contexts", async (c) => {
  const rows = await db
    .select({ id: contexts.id, name: contexts.name, emoji: contexts.emoji })
    .from(contexts)
    .orderBy(asc(contexts.name));

  return c.json(contextListSchema.parse(rows));
});

// POST /contexts → створює контекст
app.post("/contexts", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createContextInputSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const [row] = await db
    .insert(contexts)
    .values({ name: parsed.data.name, emoji: parsed.data.emoji })
    .returning();

  const payload = contextDtoSchema.parse({ id: row!.id, name: row!.name, emoji: row!.emoji });
  return c.json(payload, 201);
});

// POST /contexts/:id/thoughts → додає думки в контекст (ідемпотентно)
app.post("/contexts/:id/thoughts", async (c) => {
  const contextId = c.req.param("id");

  const json = await c.req.json().catch(() => null);
  const parsed = assignThoughtsInputSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const [ctx] = await db.select().from(contexts).where(eq(contexts.id, contextId)).limit(1);
  if (!ctx) {
    return c.json({ error: "context_not_found" }, 404);
  }

  await db
    .insert(thoughtContexts)
    .values(parsed.data.thoughtIds.map((thoughtId) => ({ thoughtId, contextId })))
    .onConflictDoNothing();

  return c.body(null, 204);
});

// DELETE /contexts/:id/thoughts/:thoughtId → прибирає думку з контексту
app.delete("/contexts/:id/thoughts/:thoughtId", async (c) => {
  const contextId = c.req.param("id");
  const thoughtId = c.req.param("thoughtId");

  await db
    .delete(thoughtContexts)
    .where(and(eq(thoughtContexts.contextId, contextId), eq(thoughtContexts.thoughtId, thoughtId)));

  return c.body(null, 204);
});

export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.log(`🟢 api на http://localhost:${env.PORT}`);
