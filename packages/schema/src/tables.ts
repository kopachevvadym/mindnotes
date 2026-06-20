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
 * Контекст — тематична група думок. Глобальний (спільний для всіх сесій).
 * `emoji` — провідний гліф (не колір), `name` — головний ідентифікатор.
 */
export const contexts = pgTable("context", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Зв'язок many-to-many: думка ↔ контекст. Складений ключ. */
export const thoughtContexts = pgTable(
  "thought_context",
  {
    thoughtId: uuid("thought_id")
      .notNull()
      .references(() => thoughts.id, { onDelete: "cascade" }),
    contextId: uuid("context_id")
      .notNull()
      .references(() => contexts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.thoughtId, t.contextId] })],
);

export type SessionRow = typeof sessions.$inferSelect;
export type ThoughtRow = typeof thoughts.$inferSelect;
export type ContextRow = typeof contexts.$inferSelect;
