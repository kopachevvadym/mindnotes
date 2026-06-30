import { Hono } from "hono";
import { cors } from "hono/cors";
import { and, asc, count, desc, eq } from "drizzle-orm";
import {
  sessions,
  thoughts,
  ideas,
  ideaThoughts,
  sessionDtoSchema,
  sessionDetailSchema,
  sessionListSchema,
  createThoughtInputSchema,
  updateThoughtInputSchema,
  updateSessionInputSchema,
  createIdeaInputSchema,
  addThoughtToIdeaInputSchema,
  updateIdeaInputSchema,
  ideaDtoSchema,
  ideaDetailSchema,
  ideaListSchema,
  thoughtDtoSchema,
  THOUGHT_EDIT_WINDOW_MIN,
} from "@mindnotes/schema";
import { db } from "./db";
import { env } from "./env";
import { serializeSession, serializeThought, serializeIdea } from "./serialize";

/** Вікно (від створення), у якому думку ще можна редагувати/видалити. */
const EDIT_WINDOW_MS = THOUGHT_EDIT_WINDOW_MIN * 60_000;
function withinEditWindow(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() <= EDIT_WINDOW_MS;
}

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

  // Для мітки-дверей: id НАЙНОВІШОЇ ідеї, яку живить кожна думка цієї сесії (null = жодної).
  const ideaLinks = await db
    .select({ thoughtId: ideaThoughts.thoughtId, ideaId: ideaThoughts.ideaId })
    .from(ideaThoughts)
    .innerJoin(thoughts, eq(thoughts.id, ideaThoughts.thoughtId))
    .innerJoin(ideas, eq(ideas.id, ideaThoughts.ideaId))
    .where(eq(thoughts.sessionId, id))
    .orderBy(desc(ideas.createdAt));

  const ideaIdByThought = new Map<string, string>();
  for (const link of ideaLinks) {
    // desc за created_at → перший побачений для думки і є найновішим.
    if (!ideaIdByThought.has(link.thoughtId)) ideaIdByThought.set(link.thoughtId, link.ideaId);
  }

  // Валідуємо відповідь спільною zod-схемою перед віддачею.
  const payload = sessionDetailSchema.parse({
    session: serializeSession(session),
    thoughts: rows.map((row) => ({
      ...serializeThought(row),
      ideaId: ideaIdByThought.get(row.id) ?? null,
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

// PATCH /thoughts/:id → архівування (будь-коли) або редагування тіла (лише в межах вікна)
app.patch("/thoughts/:id", async (c) => {
  const id = c.req.param("id");

  const json = await c.req.json().catch(() => null);
  const parsed = updateThoughtInputSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const [existing] = await db.select().from(thoughts).where(eq(thoughts.id, id)).limit(1);
  if (!existing) {
    return c.json({ error: "thought_not_found" }, 404);
  }

  // Редагування тіла — лише поки не вийшло вікно; архівування — без обмежень.
  if ("body" in parsed.data && !withinEditWindow(existing.createdAt)) {
    return c.json({ error: "edit_window_closed" }, 403);
  }

  const [row] = await db
    .update(thoughts)
    .set("body" in parsed.data ? { body: parsed.data.body } : { archived: parsed.data.archived })
    .where(eq(thoughts.id, id))
    .returning();

  const payload = thoughtDtoSchema.parse(serializeThought(row!));
  return c.json(payload);
});

// DELETE /thoughts/:id → видаляє думку (лише в межах вікна); лінки idea_thought прибирає cascade
app.delete("/thoughts/:id", async (c) => {
  const id = c.req.param("id");

  const [existing] = await db.select().from(thoughts).where(eq(thoughts.id, id)).limit(1);
  if (!existing) {
    return c.json({ error: "thought_not_found" }, 404);
  }
  if (!withinEditWindow(existing.createdAt)) {
    return c.json({ error: "delete_window_closed" }, 403);
  }

  await db.delete(thoughts).where(eq(thoughts.id, id));
  return c.body(null, 204);
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

/** Ідея + її думки з джерелом (сесією), created_at desc. null, якщо ідеї нема. */
async function loadIdeaDetail(ideaId: string) {
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
  if (!idea) return null;

  const rows = await db
    .select({
      id: thoughts.id,
      sessionId: thoughts.sessionId,
      body: thoughts.body,
      archived: thoughts.archived,
      createdAt: thoughts.createdAt,
      sessionTitle: sessions.title,
    })
    .from(ideaThoughts)
    .innerJoin(thoughts, eq(thoughts.id, ideaThoughts.thoughtId))
    .innerJoin(sessions, eq(sessions.id, thoughts.sessionId))
    .where(eq(ideaThoughts.ideaId, ideaId))
    .orderBy(desc(thoughts.createdAt));

  return ideaDetailSchema.parse({
    idea: serializeIdea(idea),
    thoughts: rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      body: r.body,
      archived: r.archived,
      createdAt: r.createdAt.toISOString(),
      sessionTitle: r.sessionTitle,
    })),
  });
}

// POST /ideas → народжує ідею (thesis=null) з думки-насінини, лінкує її, повертає ідею + думки
app.post("/ideas", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createIdeaInputSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const { seedThoughtId } = parsed.data;

  const [seed] = await db.select().from(thoughts).where(eq(thoughts.id, seedThoughtId)).limit(1);
  if (!seed) {
    return c.json({ error: "thought_not_found" }, 404);
  }

  // Створення ідеї + лінк думки-насінини — в одній транзакції.
  // bun:sqlite — синхронна транзакція (без await, з .run()/.all()).
  const idea = db.transaction((tx) => {
    const [created] = tx.insert(ideas).values({}).returning().all();
    tx.insert(ideaThoughts).values({ ideaId: created!.id, thoughtId: seedThoughtId }).run();
    return created!;
  });

  const linked = await db
    .select({
      id: thoughts.id,
      sessionId: thoughts.sessionId,
      body: thoughts.body,
      archived: thoughts.archived,
      createdAt: thoughts.createdAt,
      sessionTitle: sessions.title,
    })
    .from(ideaThoughts)
    .innerJoin(thoughts, eq(thoughts.id, ideaThoughts.thoughtId))
    .innerJoin(sessions, eq(sessions.id, thoughts.sessionId))
    .where(eq(ideaThoughts.ideaId, idea.id))
    .orderBy(asc(thoughts.createdAt));

  const payload = ideaDetailSchema.parse({
    idea: serializeIdea(idea),
    thoughts: linked.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      body: r.body,
      archived: r.archived,
      createdAt: r.createdAt.toISOString(),
      sessionTitle: r.sessionTitle,
    })),
  });

  return c.json(payload, 201);
});

// GET /ideas → скромний список ідей: id, thesis, к-ть думок, created_at; найновіші зверху
app.get("/ideas", async (c) => {
  const rows = await db
    .select({
      id: ideas.id,
      thesis: ideas.thesis,
      createdAt: ideas.createdAt,
      thoughtCount: count(ideaThoughts.thoughtId),
    })
    .from(ideas)
    .leftJoin(ideaThoughts, eq(ideaThoughts.ideaId, ideas.id))
    .groupBy(ideas.id)
    .orderBy(desc(ideas.createdAt));

  const payload = ideaListSchema.parse(
    rows.map((r) => ({
      id: r.id,
      thesis: r.thesis,
      thoughtCount: r.thoughtCount,
      createdAt: r.createdAt.toISOString(),
    })),
  );
  return c.json(payload);
});

// GET /ideas/:id → ідея + її думки з джерелом (сесією), created_at desc
app.get("/ideas/:id", async (c) => {
  const payload = await loadIdeaDetail(c.req.param("id"));
  if (!payload) {
    return c.json({ error: "idea_not_found" }, 404);
  }
  return c.json(payload);
});

// PATCH /ideas/:id → оновити тезу (порожня/null дозволена), повертає оновлену ідею
app.patch("/ideas/:id", async (c) => {
  const id = c.req.param("id");

  const json = await c.req.json().catch(() => null);
  const parsed = updateIdeaInputSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const thesis = parsed.data.thesis?.trim() ? parsed.data.thesis.trim() : null;

  const [row] = await db.update(ideas).set({ thesis }).where(eq(ideas.id, id)).returning();
  if (!row) {
    return c.json({ error: "idea_not_found" }, 404);
  }

  const payload = ideaDtoSchema.parse(serializeIdea(row));
  return c.json(payload);
});

// POST /ideas/:id/thoughts → втягнути НАЯВНУ думку в НАЯВНУ ідею (ідемпотентно), повернути ідею
app.post("/ideas/:id/thoughts", async (c) => {
  const ideaId = c.req.param("id");

  const json = await c.req.json().catch(() => null);
  const parsed = addThoughtToIdeaInputSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
  if (!idea) {
    return c.json({ error: "idea_not_found" }, 404);
  }

  const [thought] = await db
    .select()
    .from(thoughts)
    .where(eq(thoughts.id, parsed.data.thoughtId))
    .limit(1);
  if (!thought) {
    return c.json({ error: "thought_not_found" }, 404);
  }

  // Ідемпотентно: повторне втягування тієї ж думки — не дубль, не помилка.
  await db
    .insert(ideaThoughts)
    .values({ ideaId, thoughtId: parsed.data.thoughtId })
    .onConflictDoNothing();

  const payload = await loadIdeaDetail(ideaId);
  return c.json(payload!);
});

// DELETE /ideas/:id/thoughts/:thoughtId → відчепити думку від ідеї (саму думку НЕ видаляти)
app.delete("/ideas/:id/thoughts/:thoughtId", async (c) => {
  const ideaId = c.req.param("id");
  const thoughtId = c.req.param("thoughtId");

  await db
    .delete(ideaThoughts)
    .where(and(eq(ideaThoughts.ideaId, ideaId), eq(ideaThoughts.thoughtId, thoughtId)));

  return c.body(null, 204);
});

// DELETE /ideas/:id → видалити ідею: спершу лінки idea_thought, тоді саму ідею. Думки лишаються.
app.delete("/ideas/:id", async (c) => {
  const id = c.req.param("id");

  const [existing] = await db.select().from(ideas).where(eq(ideas.id, id)).limit(1);
  if (!existing) {
    return c.json({ error: "idea_not_found" }, 404);
  }

  // bun:sqlite — синхронна транзакція.
  db.transaction((tx) => {
    tx.delete(ideaThoughts).where(eq(ideaThoughts.ideaId, id)).run();
    tx.delete(ideas).where(eq(ideas.id, id)).run();
  });

  return c.body(null, 204);
});

export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.log(`🟢 api на http://localhost:${env.PORT}`);
