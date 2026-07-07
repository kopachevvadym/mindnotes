import { z } from "zod";
import {
  THOUGHT_EDIT_WINDOW_MIN,
  searchResultsSchema,
  type SearchResults,
  sessionDtoSchema,
  sessionDetailSchema,
  sessionListSchema,
  thoughtDtoSchema,
  contextDtoSchema,
  contextDetailSchema,
  contextListSchema,
  type SessionDto,
  type SessionDetail,
  type SessionListItem,
  type ThoughtDto,
  type CreateThoughtInput,
  type UpdateThoughtInput,
  type UpdateSessionInput,
  type ContextDto,
  type ContextDetail,
  type ContextListItem,
  type CreateContextInput,
  type AddThoughtToContextInput,
  type UpdateContextInput,
  readingSpanDtoSchema,
  readingSpanListSchema,
  activeReadingSpanSchema,
  stopReadingSpanResultSchema,
  type ReadingSpanDto,
  type ActiveReadingSpan,
  type StopReadingSpanResult,
  type UpdateReadingSpanInput,
} from "@mindnotes/schema";

const baseUrl = import.meta.env.VITE_API_BASE_URL;

if (!baseUrl) {
  throw new Error("VITE_API_BASE_URL не задано. Скопіюй .env.example у .env у корені монорепо.");
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Машинний код помилки з тіла відповіді бекенда ({ error: code }), якщо був. */
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Людські повідомлення для кодів помилок бекенда. */
const ERROR_MESSAGES: Record<string, string> = {
  invalid_body: "Некоректний запит.",
  session_not_found: "Сесію не знайдено.",
  thought_not_found: "Думку не знайдено.",
  context_not_found: "Ідею не знайдено.",
  edit_window_closed: `Редагувати можна лише протягом ${THOUGHT_EDIT_WINDOW_MIN} хв після запису.`,
  delete_window_closed: `Видалити можна лише протягом ${THOUGHT_EDIT_WINDOW_MIN} хв після запису.`,
  not_found: "Такого запиту немає.",
  internal: "Внутрішня помилка сервера.",
  no_active_span: "Читання вже зупинено.",
  reading_span_not_found: "Інтервал читання не знайдено.",
  invalid_span_range: "Кінець читання має бути пізніше за початок.",
  overlapping_span: "Інтервали читання не можуть перетинатися.",
};

/** Читає { error: code } з тіла невдалої відповіді й кидає ApiError з людським текстом. */
async function throwApiError(res: Response, path: string): Promise<never> {
  let code: string | null = null;
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string") code = body.error;
  } catch {
    // тіло не JSON — лишаємо code = null
  }
  const message = (code && ERROR_MESSAGES[code]) ?? `Запит ${path} повернув ${res.status}`;
  throw new ApiError(message, res.status, code);
}

/**
 * Єдиний типізований fetch-клієнт. Кожна відповідь валідується спільною
 * zod-схемою з @mindnotes/schema. Жодних localhost-рядків поза цим модулем.
 */
async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });

  if (!res.ok) {
    await throwApiError(res, path);
  }

  const json = (await res.json()) as unknown;
  return schema.parse(json);
}

/** Те саме для запитів без тіла відповіді (DELETE → 204). */
async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });

  if (!res.ok) {
    await throwApiError(res, path);
  }
}

export const api = {
  getSessions(): Promise<SessionListItem[]> {
    return request(`/sessions`, sessionListSchema);
  },

  search(q: string): Promise<SearchResults> {
    return request(`/search?q=${encodeURIComponent(q)}`, searchResultsSchema);
  },

  createSession(): Promise<SessionDto> {
    return request(`/sessions`, sessionDtoSchema, { method: "POST" });
  },

  updateSession(id: string, input: UpdateSessionInput): Promise<SessionDto> {
    return request(`/sessions/${id}`, sessionDtoSchema, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  deleteSession(id: string): Promise<void> {
    return requestVoid(`/sessions/${id}`, { method: "DELETE" });
  },

  getSession(id: string): Promise<SessionDetail> {
    return request(`/sessions/${id}`, sessionDetailSchema);
  },

  createThought(sessionId: string, input: CreateThoughtInput): Promise<ThoughtDto> {
    return request(`/sessions/${sessionId}/thoughts`, thoughtDtoSchema, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  updateThought(id: string, input: UpdateThoughtInput): Promise<ThoughtDto> {
    return request(`/thoughts/${id}`, thoughtDtoSchema, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  deleteThought(id: string): Promise<void> {
    return requestVoid(`/thoughts/${id}`, { method: "DELETE" });
  },

  createContext(input: CreateContextInput): Promise<ContextDetail> {
    return request(`/contexts`, contextDetailSchema, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  getContexts(): Promise<ContextListItem[]> {
    return request(`/contexts`, contextListSchema);
  },

  getContext(id: string): Promise<ContextDetail> {
    return request(`/contexts/${id}`, contextDetailSchema);
  },

  updateContext(id: string, input: UpdateContextInput): Promise<ContextDto> {
    return request(`/contexts/${id}`, contextDtoSchema, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  addThoughtToContext(contextId: string, input: AddThoughtToContextInput): Promise<ContextDetail> {
    return request(`/contexts/${contextId}/thoughts`, contextDetailSchema, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  removeThoughtFromContext(contextId: string, thoughtId: string): Promise<void> {
    return requestVoid(`/contexts/${contextId}/thoughts/${thoughtId}`, { method: "DELETE" });
  },

  deleteContext(id: string): Promise<void> {
    return requestVoid(`/contexts/${id}`, { method: "DELETE" });
  },

  startReadingSpan(sessionId?: string): Promise<ReadingSpanDto> {
    return request(`/reading-spans/start`, readingSpanDtoSchema, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId ?? null }),
    });
  },

  stopReadingSpan(): Promise<StopReadingSpanResult> {
    return request(`/reading-spans/stop`, stopReadingSpanResultSchema, { method: "POST" });
  },

  getActiveReadingSpan(): Promise<ActiveReadingSpan> {
    return request(`/reading-spans/active`, activeReadingSpanSchema);
  },

  getReadingSpans(sessionId: string): Promise<ReadingSpanDto[]> {
    return request(
      `/reading-spans?sessionId=${encodeURIComponent(sessionId)}`,
      readingSpanListSchema,
    );
  },

  updateReadingSpan(id: string, input: UpdateReadingSpanInput): Promise<ReadingSpanDto> {
    return request(`/reading-spans/${id}`, readingSpanDtoSchema, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  deleteReadingSpan(id: string): Promise<void> {
    return requestVoid(`/reading-spans/${id}`, { method: "DELETE" });
  },
};
