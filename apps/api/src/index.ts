import { Hono } from "hono";
import { cors } from "hono/cors";
import { asc, count, desc, eq } from "drizzle-orm";
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
  ideaDetailSchema,
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

  // Скільки ідей живить кожна думка цієї сесії → мапа thoughtId → count.
  const ideaCounts = await db
    .select({ thoughtId: ideaThoughts.thoughtId, ideas: count(ideaThoughts.ideaId) })
    .from(ideaThoughts)
    .innerJoin(thoughts, eq(thoughts.id, ideaThoughts.thoughtId))
    .where(eq(thoughts.sessionId, id))
    .groupBy(ideaThoughts.thoughtId);

  const ideaCountByThought = new Map<string, number>();
  for (const row of ideaCounts) {
    ideaCountByThought.set(row.thoughtId, Number(row.ideas));
  }

  // Валідуємо відповідь спільною zod-схемою перед віддачею.
  const payload = sessionDetailSchema.parse({
    session: serializeSession(session),
    thoughts: rows.map((row) => ({
      ...serializeThought(row),
      ideaCount: ideaCountByThought.get(row.id) ?? 0,
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
  const idea = await db.transaction(async (tx) => {
    const [created] = await tx.insert(ideas).values({}).returning();
    await tx.insert(ideaThoughts).values({ ideaId: created!.id, thoughtId: seedThoughtId });
    return created!;
  });

  const linked = await db
    .select()
    .from(thoughts)
    .innerJoin(ideaThoughts, eq(ideaThoughts.thoughtId, thoughts.id))
    .where(eq(ideaThoughts.ideaId, idea.id))
    .orderBy(asc(thoughts.createdAt));

  const payload = ideaDetailSchema.parse({
    idea: serializeIdea(idea),
    thoughts: linked.map((r) => serializeThought(r.thought)),
  });

  return c.json(payload, 201);
});

export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.log(`🟢 api на http://localhost:${env.PORT}`);
