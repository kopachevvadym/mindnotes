import { Hono } from "hono";
import { cors } from "hono/cors";
import { and, asc, count, desc, eq, gte, isNull, lte, ne, or } from "drizzle-orm";
import {
  sessions,
  thoughts,
  contexts,
  contextThoughts,
  readingSpans,
  sessionDtoSchema,
  sessionDetailSchema,
  sessionListSchema,
  createThoughtInputSchema,
  updateThoughtInputSchema,
  updateSessionInputSchema,
  createContextInputSchema,
  addThoughtToContextInputSchema,
  updateContextInputSchema,
  contextDtoSchema,
  contextDetailSchema,
  contextListSchema,
  thoughtDtoSchema,
  searchResultsSchema,
  readingSpanDtoSchema,
  readingSpanListSchema,
  activeReadingSpanSchema,
  stopReadingSpanResultSchema,
  updateReadingSpanInputSchema,
  THOUGHT_EDIT_WINDOW_MIN,
  READING_SPAN_MIN_MIN,
} from "@mindnotes/schema";
import { z } from "zod";
import { db } from "./db";
import { env } from "./env";
import {
  serializeSession,
  serializeThought,
  serializeContext,
  serializeReadingSpan,
} from "./serialize";

/** Вікно (від створення), у якому думку ще можна редагувати/видалити. */
const EDIT_WINDOW_MS = THOUGHT_EDIT_WINDOW_MIN * 60_000;
function withinEditWindow(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() <= EDIT_WINDOW_MS;
}

export const app = new Hono();

app.use(
  "/*",
  cors({
    origin: env.WEB_ORIGIN,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// Помилки завжди віддаємо у формі { error: code } — фронт мапить коди на людські тексти.
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal" }, 500);
});

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.get("/health", (c) => c.json({ ok: true }));

/** Скільки збігів віддавати на групу результатів. */
const SEARCH_LIMITS = { sessions: 5, contexts: 5, thoughts: 8 };

// GET /search?q= → сесії за назвою, групи за тезою/превʼю, думки за текстом.
// Фільтруємо в JS: lower() у SQLite не згортає кирилицю, а обсяг даних локальний.
app.get("/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim().toLowerCase();

  if (!q) {
    const empty = searchResultsSchema.parse({ sessions: [], contexts: [], thoughts: [] });
    return c.json(empty);
  }

  const matches = (value: string | null) => (value ?? "").toLowerCase().includes(q);

  const sessionRows = await db
    .select({ id: sessions.id, title: sessions.title, createdAt: sessions.createdAt })
    .from(sessions)
    .orderBy(desc(sessions.createdAt));

  const contextRows = await db
    .select({ id: contexts.id, thesis: contexts.thesis })
    .from(contexts)
    .orderBy(desc(contexts.createdAt));
  const previewByContext = await loadContextPreviews();

  const thoughtRows = await db
    .select({
      id: thoughts.id,
      sessionId: thoughts.sessionId,
      body: thoughts.body,
      sessionTitle: sessions.title,
    })
    .from(thoughts)
    .innerJoin(sessions, eq(sessions.id, thoughts.sessionId))
    .orderBy(desc(thoughts.createdAt));

  const payload = searchResultsSchema.parse({
    sessions: sessionRows
      .filter((s) => matches(s.title))
      .slice(0, SEARCH_LIMITS.sessions)
      .map((s) => ({ id: s.id, title: s.title, createdAt: s.createdAt.toISOString() })),
    contexts: contextRows
      .map((g) => ({ id: g.id, thesis: g.thesis, previewBody: previewByContext.get(g.id) ?? null }))
      .filter((g) => matches(g.thesis) || matches(g.previewBody))
      .slice(0, SEARCH_LIMITS.contexts),
    thoughts: thoughtRows.filter((t) => matches(t.body)).slice(0, SEARCH_LIMITS.thoughts),
  });

  return c.json(payload);
});

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
  const contextLinks = await db
    .select({ thoughtId: contextThoughts.thoughtId, contextId: contextThoughts.contextId })
    .from(contextThoughts)
    .innerJoin(thoughts, eq(thoughts.id, contextThoughts.thoughtId))
    .innerJoin(contexts, eq(contexts.id, contextThoughts.contextId))
    .where(eq(thoughts.sessionId, id))
    .orderBy(desc(contexts.createdAt));

  const contextIdByThought = new Map<string, string>();
  for (const link of contextLinks) {
    // desc за created_at → перший побачений для думки і є найновішим.
    if (!contextIdByThought.has(link.thoughtId)) contextIdByThought.set(link.thoughtId, link.contextId);
  }

  // Валідуємо відповідь спільною zod-схемою перед віддачею.
  const payload = sessionDetailSchema.parse({
    session: serializeSession(session),
    thoughts: rows.map((row) => ({
      ...serializeThought(row),
      contextId: contextIdByThought.get(row.id) ?? null,
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

// DELETE /thoughts/:id → видаляє думку (лише в межах вікна); лінки context_thought прибирає cascade
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
async function loadContextDetail(contextId: string) {
  const [context] = await db.select().from(contexts).where(eq(contexts.id, contextId)).limit(1);
  if (!context) return null;

  const rows = await db
    .select({
      id: thoughts.id,
      sessionId: thoughts.sessionId,
      body: thoughts.body,
      archived: thoughts.archived,
      createdAt: thoughts.createdAt,
      sessionTitle: sessions.title,
    })
    .from(contextThoughts)
    .innerJoin(thoughts, eq(thoughts.id, contextThoughts.thoughtId))
    .innerJoin(sessions, eq(sessions.id, thoughts.sessionId))
    .where(eq(contextThoughts.contextId, contextId))
    .orderBy(desc(thoughts.createdAt));

  return contextDetailSchema.parse({
    context: serializeContext(context),
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

// POST /contexts → народжує ідею (thesis=null) з думки-насінини, лінкує її, повертає ідею + думки
app.post("/contexts", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createContextInputSchema.safeParse(json);
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
  const context = db.transaction((tx) => {
    const [created] = tx.insert(contexts).values({}).returning().all();
    tx.insert(contextThoughts).values({ contextId: created!.id, thoughtId: seedThoughtId }).run();
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
    .from(contextThoughts)
    .innerJoin(thoughts, eq(thoughts.id, contextThoughts.thoughtId))
    .innerJoin(sessions, eq(sessions.id, thoughts.sessionId))
    .where(eq(contextThoughts.contextId, context.id))
    .orderBy(asc(thoughts.createdAt));

  const payload = contextDetailSchema.parse({
    context: serializeContext(context),
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

/** Тіло найранішої думки кожної групи — превʼю для груп без тези. */
async function loadContextPreviews(): Promise<Map<string, string>> {
  const rows = await db
    .select({ contextId: contextThoughts.contextId, body: thoughts.body })
    .from(contextThoughts)
    .innerJoin(thoughts, eq(thoughts.id, contextThoughts.thoughtId))
    .orderBy(asc(thoughts.createdAt));

  const previewByContext = new Map<string, string>();
  for (const row of rows) {
    // asc за created_at → перше побачене для групи і є найранішим.
    if (!previewByContext.has(row.contextId)) previewByContext.set(row.contextId, row.body);
  }
  return previewByContext;
}

// GET /contexts → скромний список груп: id, thesis, к-ть думок, превʼю, created_at; найновіші зверху
app.get("/contexts", async (c) => {
  const rows = await db
    .select({
      id: contexts.id,
      thesis: contexts.thesis,
      createdAt: contexts.createdAt,
      thoughtCount: count(contextThoughts.thoughtId),
    })
    .from(contexts)
    .leftJoin(contextThoughts, eq(contextThoughts.contextId, contexts.id))
    .groupBy(contexts.id)
    .orderBy(desc(contexts.createdAt));

  const previewByContext = await loadContextPreviews();

  const payload = contextListSchema.parse(
    rows.map((r) => ({
      id: r.id,
      thesis: r.thesis,
      thoughtCount: r.thoughtCount,
      previewBody: previewByContext.get(r.id) ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  );
  return c.json(payload);
});

// GET /contexts/:id → ідея + її думки з джерелом (сесією), created_at desc
app.get("/contexts/:id", async (c) => {
  const payload = await loadContextDetail(c.req.param("id"));
  if (!payload) {
    return c.json({ error: "context_not_found" }, 404);
  }
  return c.json(payload);
});

// PATCH /contexts/:id → оновити тезу (порожня/null дозволена), повертає оновлену ідею
app.patch("/contexts/:id", async (c) => {
  const id = c.req.param("id");

  const json = await c.req.json().catch(() => null);
  const parsed = updateContextInputSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const thesis = parsed.data.thesis?.trim() ? parsed.data.thesis.trim() : null;

  const [row] = await db.update(contexts).set({ thesis }).where(eq(contexts.id, id)).returning();
  if (!row) {
    return c.json({ error: "context_not_found" }, 404);
  }

  const payload = contextDtoSchema.parse(serializeContext(row));
  return c.json(payload);
});

// POST /contexts/:id/thoughts → втягнути НАЯВНУ думку в НАЯВНУ ідею (ідемпотентно), повернути ідею
app.post("/contexts/:id/thoughts", async (c) => {
  const contextId = c.req.param("id");

  const json = await c.req.json().catch(() => null);
  const parsed = addThoughtToContextInputSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const [context] = await db.select().from(contexts).where(eq(contexts.id, contextId)).limit(1);
  if (!context) {
    return c.json({ error: "context_not_found" }, 404);
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
    .insert(contextThoughts)
    .values({ contextId, thoughtId: parsed.data.thoughtId })
    .onConflictDoNothing();

  const payload = await loadContextDetail(contextId);
  return c.json(payload!);
});

// DELETE /contexts/:id/thoughts/:thoughtId → відчепити думку від ідеї (саму думку НЕ видаляти)
app.delete("/contexts/:id/thoughts/:thoughtId", async (c) => {
  const contextId = c.req.param("id");
  const thoughtId = c.req.param("thoughtId");

  await db
    .delete(contextThoughts)
    .where(and(eq(contextThoughts.contextId, contextId), eq(contextThoughts.thoughtId, thoughtId)));

  return c.body(null, 204);
});

// DELETE /contexts/:id → видалити ідею: спершу лінки context_thought, тоді саму ідею. Думки лишаються.
app.delete("/contexts/:id", async (c) => {
  const id = c.req.param("id");

  const [existing] = await db.select().from(contexts).where(eq(contexts.id, id)).limit(1);
  if (!existing) {
    return c.json({ error: "context_not_found" }, 404);
  }

  // bun:sqlite — синхронна транзакція.
  db.transaction((tx) => {
    tx.delete(contextThoughts).where(eq(contextThoughts.contextId, id)).run();
    tx.delete(contexts).where(eq(contexts.id, id)).run();
  });

  return c.body(null, 204);
});

/** Активний читацький інтервал (ended_at IS NULL) або undefined. */
async function findActiveSpan() {
  const [row] = await db
    .select()
    .from(readingSpans)
    .where(isNull(readingSpans.endedAt))
    .orderBy(desc(readingSpans.startedAt))
    .limit(1);
  return row;
}

// POST /reading-spans/start → ідемпотентно: якщо активний уже є — повертаємо його
app.post("/reading-spans/start", async (c) => {
  const active = await findActiveSpan();
  if (active) {
    return c.json(readingSpanDtoSchema.parse(serializeReadingSpan(active)));
  }

  const [row] = await db.insert(readingSpans).values({}).returning();
  return c.json(readingSpanDtoSchema.parse(serializeReadingSpan(row!)), 201);
});

// POST /reading-spans/stop → закрити активний. Коротше за поріг — видалити (discarded).
// Нема активного → 404 no_active_span (обрано явну помилку: клієнт просто рефетчить стан).
app.post("/reading-spans/stop", async (c) => {
  const active = await findActiveSpan();
  if (!active) {
    return c.json({ error: "no_active_span" }, 404);
  }

  const now = new Date();
  const durationMin = (now.getTime() - active.startedAt.getTime()) / 60_000;

  if (durationMin < READING_SPAN_MIN_MIN) {
    await db.delete(readingSpans).where(eq(readingSpans.id, active.id));
    return c.json(stopReadingSpanResultSchema.parse({ discarded: true, span: null }));
  }

  const [row] = await db
    .update(readingSpans)
    .set({ endedAt: now })
    .where(eq(readingSpans.id, active.id))
    .returning();

  return c.json(
    stopReadingSpanResultSchema.parse({ discarded: false, span: serializeReadingSpan(row!) }),
  );
});

// GET /reading-spans/active → { span | null } (відновлення стану кнопки після рефреша)
app.get("/reading-spans/active", async (c) => {
  const active = await findActiveSpan();
  return c.json(
    activeReadingSpanSchema.parse({ span: active ? serializeReadingSpan(active) : null }),
  );
});

const spansRangeQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

// GET /reading-spans?from=&to= → спани, що ПЕРЕТИНАЮТЬ діапазон (для рендера в потоці).
// Активний (ended_at NULL) вважається відкритим досі, тож перетинає будь-який from ≤ зараз.
app.get("/reading-spans", async (c) => {
  const parsed = spansRangeQuerySchema.safeParse({
    from: c.req.query("from"),
    to: c.req.query("to"),
  });
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const conds = [];
  if (parsed.data.from) {
    const from = new Date(parsed.data.from);
    conds.push(or(isNull(readingSpans.endedAt), gte(readingSpans.endedAt, from)));
  }
  if (parsed.data.to) {
    conds.push(lte(readingSpans.startedAt, new Date(parsed.data.to)));
  }

  const rows = await db
    .select()
    .from(readingSpans)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(readingSpans.startedAt));

  return c.json(readingSpanListSchema.parse(rows.map(serializeReadingSpan)));
});

// PATCH /reading-spans/:id → редагувати started_at та/або ended_at; валідність: кінець > початок
app.patch("/reading-spans/:id", async (c) => {
  const id = c.req.param("id");

  const json = await c.req.json().catch(() => null);
  const parsed = updateReadingSpanInputSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const [existing] = await db.select().from(readingSpans).where(eq(readingSpans.id, id)).limit(1);
  if (!existing) {
    return c.json({ error: "reading_span_not_found" }, 404);
  }

  const startedAt = parsed.data.startedAt ? new Date(parsed.data.startedAt) : existing.startedAt;
  const endedAt = parsed.data.endedAt ? new Date(parsed.data.endedAt) : existing.endedAt;

  if (endedAt && endedAt.getTime() <= startedAt.getTime()) {
    return c.json({ error: "invalid_span_range" }, 400);
  }

  // Інваріант «спани не перетинаються»: редагування меж не сміє наїхати на сусіда.
  const others = await db.select().from(readingSpans).where(ne(readingSpans.id, id));
  const myStart = startedAt.getTime();
  const myEnd = endedAt ? endedAt.getTime() : Infinity;
  const overlaps = others.some((o) => {
    const oStart = o.startedAt.getTime();
    const oEnd = o.endedAt ? o.endedAt.getTime() : Infinity;
    return oStart < myEnd && oEnd > myStart;
  });
  if (overlaps) {
    return c.json({ error: "overlapping_span" }, 400);
  }

  const [row] = await db
    .update(readingSpans)
    .set({ startedAt, endedAt })
    .where(eq(readingSpans.id, id))
    .returning();

  return c.json(readingSpanDtoSchema.parse(serializeReadingSpan(row!)));
});

// DELETE /reading-spans/:id → видалити інтервал (думки не чіпає — вони живуть у сесіях)
app.delete("/reading-spans/:id", async (c) => {
  const id = c.req.param("id");

  const [row] = await db.delete(readingSpans).where(eq(readingSpans.id, id)).returning();
  if (!row) {
    return c.json({ error: "reading_span_not_found" }, 404);
  }

  return c.body(null, 204);
});

export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.log(`🟢 api на http://localhost:${env.PORT}`);
