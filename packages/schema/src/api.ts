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

/** Думка в межах сесії — з id одного (найновішого) контексту для мітки-дверей; null = поза контекстами. */
export const sessionThoughtDtoSchema = thoughtDtoSchema.extend({
  contextId: z.uuid().nullable(),
});

/** GET /sessions/:id */
export const sessionDetailSchema = z.object({
  session: sessionDtoSchema,
  thoughts: z.array(sessionThoughtDtoSchema),
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

/** PATCH /thoughts/:id — тіло запиту: АБО архівування, АБО редагування тіла. */
export const updateThoughtInputSchema = z.union([
  z.object({ archived: z.boolean() }),
  z.object({ body: z.string().trim().min(1) }),
]);

/** Контекст/ідея — група з опційною тезою (NULL ⇒ контекст, заповнена ⇒ ідея). */
export const contextDtoSchema = z.object({
  id: z.uuid(),
  thesis: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});

/** Думка-член контексту — з джерелом (сесією). */
export const contextThoughtDtoSchema = thoughtDtoSchema.extend({
  sessionTitle: z.string().nullable(),
});

/** POST /contexts — тіло запиту: думка-насінина. */
export const createContextInputSchema = z.object({
  seedThoughtId: z.uuid(),
});

/** POST /contexts/:id/thoughts — тіло запиту: наявна думка, яку втягуємо в наявний контекст. */
export const addThoughtToContextInputSchema = z.object({
  thoughtId: z.uuid(),
});

/** PATCH /contexts/:id — тіло запиту. Теза ніколи не обовʼязкова (може бути null). */
export const updateContextInputSchema = z.object({
  thesis: z.string().nullable(),
});

/** POST /contexts та GET /contexts/:id — контекст разом з його думками (з джерелом). */
export const contextDetailSchema = z.object({
  context: contextDtoSchema,
  thoughts: z.array(contextThoughtDtoSchema),
});

/** Елемент списку контекстів (GET /contexts) — з агрегатом кількості думок. */
export const contextListItemSchema = z.object({
  id: z.uuid(),
  thesis: z.string().nullable(),
  thoughtCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime({ offset: true }),
});

export const contextListSchema = z.array(contextListItemSchema);

export type ThoughtDto = z.infer<typeof thoughtDtoSchema>;
export type SessionThoughtDto = z.infer<typeof sessionThoughtDtoSchema>;
export type SessionDto = z.infer<typeof sessionDtoSchema>;
export type SessionDetail = z.infer<typeof sessionDetailSchema>;
export type SessionListItem = z.infer<typeof sessionListItemSchema>;
export type CreateThoughtInput = z.infer<typeof createThoughtInputSchema>;
export type UpdateThoughtInput = z.infer<typeof updateThoughtInputSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionInputSchema>;
export type ContextDto = z.infer<typeof contextDtoSchema>;
export type ContextThoughtDto = z.infer<typeof contextThoughtDtoSchema>;
export type ContextDetail = z.infer<typeof contextDetailSchema>;
export type ContextListItem = z.infer<typeof contextListItemSchema>;
export type CreateContextInput = z.infer<typeof createContextInputSchema>;
export type AddThoughtToContextInput = z.infer<typeof addThoughtToContextInputSchema>;
export type UpdateContextInput = z.infer<typeof updateContextInputSchema>;
