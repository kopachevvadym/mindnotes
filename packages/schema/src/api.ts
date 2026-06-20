import { z } from "zod";

/**
 * DTO-схеми відповідей бекенда. Дати серіалізуються в JSON як ISO-рядки, тож тут
 * вони саме рядки (а не Date). Цими схемами валідуємо відповідь на ОБОХ боках:
 * бекенд — перед `c.json(...)`, фронт — у api-клієнті.
 */

export const thoughtDtoSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  body: z.string(),
  archived: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
});

export const sessionDtoSchema = z.object({
  id: z.uuid(),
  title: z.string().nullable(),
  startedAt: z.iso.datetime({ offset: true }),
  createdAt: z.iso.datetime({ offset: true }),
});

/** Думка в межах сесії — з її контекстами (для підсвічування в Синтезі). */
export const sessionThoughtDtoSchema = thoughtDtoSchema.extend({
  contextIds: z.array(z.uuid()),
});

/** GET /sessions/:id */
export const sessionDetailSchema = z.object({
  session: sessionDtoSchema,
  thoughts: z.array(sessionThoughtDtoSchema),
});

/** Контекст для списку/пікера. */
export const contextDtoSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  emoji: z.string(),
});

export const contextListSchema = z.array(contextDtoSchema);

/** POST /contexts — тіло запиту. */
export const createContextInputSchema = z.object({
  name: z.string().trim().min(1),
  emoji: z.string().trim().min(1),
});

/** POST /contexts/:id/thoughts — тіло запиту (ідемпотентно). */
export const assignThoughtsInputSchema = z.object({
  thoughtIds: z.array(z.uuid()).min(1),
});

/** Думка на сторінці контексту — з джерелом (сесією). */
export const contextThoughtDtoSchema = thoughtDtoSchema.extend({
  sessionTitle: z.string().nullable(),
});

/** GET /contexts/:id */
export const contextDetailSchema = z.object({
  context: contextDtoSchema,
  thoughts: z.array(contextThoughtDtoSchema),
});

/** Елемент списку сесій (GET /sessions) — з агрегатом кількості думок. */
export const sessionListItemSchema = z.object({
  id: z.uuid(),
  title: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  thoughtCount: z.number().int().nonnegative(),
});

export const sessionListSchema = z.array(sessionListItemSchema);

/** PATCH /sessions/:id — тіло запиту. Назва ніколи не обовʼязкова. */
export const updateSessionInputSchema = z.object({
  title: z.string().nullable(),
});

/** POST /sessions/:id/thoughts — тіло запиту. body непорожній після trim. */
export const createThoughtInputSchema = z.object({
  body: z.string().trim().min(1),
});

/** PATCH /thoughts/:id — тіло запиту. */
export const updateThoughtInputSchema = z.object({
  archived: z.boolean(),
});

export type ThoughtDto = z.infer<typeof thoughtDtoSchema>;
export type SessionThoughtDto = z.infer<typeof sessionThoughtDtoSchema>;
export type SessionDto = z.infer<typeof sessionDtoSchema>;
export type SessionDetail = z.infer<typeof sessionDetailSchema>;
export type SessionListItem = z.infer<typeof sessionListItemSchema>;
export type ContextDto = z.infer<typeof contextDtoSchema>;
export type ContextThoughtDto = z.infer<typeof contextThoughtDtoSchema>;
export type ContextDetail = z.infer<typeof contextDetailSchema>;
export type CreateThoughtInput = z.infer<typeof createThoughtInputSchema>;
export type UpdateThoughtInput = z.infer<typeof updateThoughtInputSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionInputSchema>;
export type CreateContextInput = z.infer<typeof createContextInputSchema>;
export type AssignThoughtsInput = z.infer<typeof assignThoughtsInputSchema>;
