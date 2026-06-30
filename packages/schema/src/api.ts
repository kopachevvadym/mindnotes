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

/** Думка в межах сесії — з id однієї (найновішої) ідеї для мітки-дверей; null = не в ідеї. */
export const sessionThoughtDtoSchema = thoughtDtoSchema.extend({
  ideaId: z.uuid().nullable(),
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

/** Ідея — сутність із власною тезою (NULL, доки не сформульована). */
export const ideaDtoSchema = z.object({
  id: z.uuid(),
  thesis: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});

/** Думка-член ідеї — з джерелом (сесією). */
export const ideaThoughtDtoSchema = thoughtDtoSchema.extend({
  sessionTitle: z.string().nullable(),
});

/** POST /ideas — тіло запиту: думка-насінина. */
export const createIdeaInputSchema = z.object({
  seedThoughtId: z.uuid(),
});

/** PATCH /ideas/:id — тіло запиту. Теза ніколи не обовʼязкова (може бути null). */
export const updateIdeaInputSchema = z.object({
  thesis: z.string().nullable(),
});

/** POST /ideas та GET /ideas/:id — ідея разом з її думками (з джерелом). */
export const ideaDetailSchema = z.object({
  idea: ideaDtoSchema,
  thoughts: z.array(ideaThoughtDtoSchema),
});

/** Елемент списку ідей (GET /ideas) — з агрегатом кількості думок. */
export const ideaListItemSchema = z.object({
  id: z.uuid(),
  thesis: z.string().nullable(),
  thoughtCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime({ offset: true }),
});

export const ideaListSchema = z.array(ideaListItemSchema);

export type ThoughtDto = z.infer<typeof thoughtDtoSchema>;
export type SessionThoughtDto = z.infer<typeof sessionThoughtDtoSchema>;
export type SessionDto = z.infer<typeof sessionDtoSchema>;
export type SessionDetail = z.infer<typeof sessionDetailSchema>;
export type SessionListItem = z.infer<typeof sessionListItemSchema>;
export type CreateThoughtInput = z.infer<typeof createThoughtInputSchema>;
export type UpdateThoughtInput = z.infer<typeof updateThoughtInputSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionInputSchema>;
export type IdeaDto = z.infer<typeof ideaDtoSchema>;
export type IdeaThoughtDto = z.infer<typeof ideaThoughtDtoSchema>;
export type IdeaDetail = z.infer<typeof ideaDetailSchema>;
export type IdeaListItem = z.infer<typeof ideaListItemSchema>;
export type CreateIdeaInput = z.infer<typeof createIdeaInputSchema>;
export type UpdateIdeaInput = z.infer<typeof updateIdeaInputSchema>;
