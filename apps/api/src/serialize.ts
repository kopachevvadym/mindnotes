import type {
  SessionRow,
  ThoughtRow,
  ContextRow,
  SessionDto,
  ThoughtDto,
  ContextDto,
} from "@mindnotes/schema";

/** Перетворюємо рядки drizzle (з Date) у DTO з ISO-рядками. */
export function serializeSession(row: SessionRow): SessionDto {
  return {
    id: row.id,
    title: row.title,
    startedAt: row.startedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeThought(row: ThoughtRow): ThoughtDto {
  return {
    id: row.id,
    sessionId: row.sessionId,
    body: row.body,
    archived: row.archived,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeContext(row: ContextRow): ContextDto {
  return {
    id: row.id,
    thesis: row.thesis,
    createdAt: row.createdAt.toISOString(),
  };
}
