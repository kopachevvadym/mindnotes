import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

/** uuid-рядок як id (SQLite не має типу uuid). */
const uuidPk = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/** Час як ціле (unix ms), drizzle віддає/приймає Date — тож serialize/toISOString не міняються. */
const tsNow = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

/**
 * Сесія читання. Може бути без назви (`title` NULL) — користувач не зобовʼязаний
 * іменувати її одразу.
 */
export const sessions = sqliteTable("session", {
  id: uuidPk(),
  title: text("title"),
  startedAt: tsNow("started_at"),
  createdAt: tsNow("created_at"),
});

/**
 * Одна думка в межах сесії. `archived` ховає думку з основного потоку (крок 2+),
 * але запис лишається.
 */
export const thoughts = sqliteTable("thought", {
  id: uuidPk(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: tsNow("created_at"),
});

/**
 * Група думок на градієнті зрілості: порожня теза ⇒ «контекст» (тематична група),
 * заповнена ⇒ «ідея». Один обʼєкт, НЕ окремі сутності. Росте знизу: народжується
 * з конкретної думки-насінини.
 */
export const contexts = sqliteTable("context", {
  id: uuidPk(),
  thesis: text("thesis"),
  createdAt: tsNow("created_at"),
});

/** Зв'язок many-to-many: контекст ↔ думка. Складений ключ. */
export const contextThoughts = sqliteTable(
  "context_thought",
  {
    contextId: text("context_id")
      .notNull()
      .references(() => contexts.id, { onDelete: "cascade" }),
    thoughtId: text("thought_id")
      .notNull()
      .references(() => thoughts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.contextId, t.thoughtId] })],
);

/**
 * Читацький інтервал (reading span) — таймований відрізок реального читання.
 * ГЛОБАЛЬНИЙ: без FK до сесії-контейнера; думки належать спанові неявно
 * (created_at ∈ [started_at, ended_at]). ended_at NULL ⇒ таймер іде (активний один).
 */
export const readingSpans = sqliteTable("reading_span", {
  id: uuidPk(),
  // Сесія, у якій стартував таймер — слід «чиє це читання» (не жорсткий FK: при
  // видаленні сесії інтервал лишається як глобальний сирота). NULL = без прив'язки.
  sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
  startedAt: tsNow("started_at"),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
  createdAt: tsNow("created_at"),
});

export type SessionRow = typeof sessions.$inferSelect;
export type ThoughtRow = typeof thoughts.$inferSelect;
export type ContextRow = typeof contexts.$inferSelect;
export type ReadingSpanRow = typeof readingSpans.$inferSelect;
