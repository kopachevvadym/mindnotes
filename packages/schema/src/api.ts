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

/** GET /sessions/:id */
export const sessionDetailSchema = z.object({
  session: sessionDtoSchema,
  thoughts: z.array(thoughtDtoSchema),
});

export type ThoughtDto = z.infer<typeof thoughtDtoSchema>;
export type SessionDto = z.infer<typeof sessionDtoSchema>;
export type SessionDetail = z.infer<typeof sessionDetailSchema>;
