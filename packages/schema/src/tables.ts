import { pgTable, uuid, text, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";

/**
 * Сесія читання. Може бути без назви (`title` NULL) — користувач не зобовʼязаний
 * іменувати її одразу.
 */
export const sessions = pgTable("session", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Одна думка в межах сесії. `archived` ховає думку з основного потоку (крок 2+),
 * але запис лишається.
 */
export const thoughts = pgTable("thought", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Ідея — сутність із власною тезою (NULL, доки не сформульована). Росте знизу:
 * народжується з конкретної думки-насінини.
 */
export const ideas = pgTable("idea", {
  id: uuid("id").primaryKey().defaultRandom(),
  thesis: text("thesis"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Зв'язок many-to-many: ідея ↔ думка. Складений ключ. */
export const ideaThoughts = pgTable(
  "idea_thought",
  {
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    thoughtId: uuid("thought_id")
      .notNull()
      .references(() => thoughts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.ideaId, t.thoughtId] })],
);

export type SessionRow = typeof sessions.$inferSelect;
export type ThoughtRow = typeof thoughts.$inferSelect;
export type IdeaRow = typeof ideas.$inferSelect;
