import type {
  SessionRow,
  ThoughtRow,
  ContextRow,
  ReadingSpanRow,
  SessionDto,
  ThoughtDto,
  ContextDto,
  ReadingSpanDto,
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

export function serializeReadingSpan(row: ReadingSpanRow): ReadingSpanDto {
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
