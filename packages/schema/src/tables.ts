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
 * Ідея — сутність із власною тезою (NULL, доки не сформульована). Росте знизу:
 * народжується з конкретної думки-насінини.
 */
export const ideas = sqliteTable("idea", {
  id: uuidPk(),
  thesis: text("thesis"),
  createdAt: tsNow("created_at"),
});

/** Зв'язок many-to-many: ідея ↔ думка. Складений ключ. */
export const ideaThoughts = sqliteTable(
  "idea_thought",
  {
    ideaId: text("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    thoughtId: text("thought_id")
      .notNull()
      .references(() => thoughts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.ideaId, t.thoughtId] })],
);

export type SessionRow = typeof sessions.$inferSelect;
export type ThoughtRow = typeof thoughts.$inferSelect;
export type IdeaRow = typeof ideas.$inferSelect;
