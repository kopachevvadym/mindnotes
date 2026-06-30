import { z } from "zod";
import {
  sessionDtoSchema,
  sessionDetailSchema,
  sessionListSchema,
  thoughtDtoSchema,
  type SessionDto,
  type SessionDetail,
  type SessionListItem,
  type ThoughtDto,
  type CreateThoughtInput,
  type UpdateThoughtInput,
  type UpdateSessionInput,
} from "@mindnotes/schema";

const baseUrl = import.meta.env.VITE_API_BASE_URL;

if (!baseUrl) {
  throw new Error("VITE_API_BASE_URL не задано. Скопіюй .env.example у .env у корені монорепо.");
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
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
    throw new ApiError(`Запит ${path} повернув ${res.status}`, res.status);
  }

  const json = (await res.json()) as unknown;
  return schema.parse(json);
}

export const api = {
  getSessions(): Promise<SessionListItem[]> {
    return request(`/sessions`, sessionListSchema);
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

  async deleteSession(id: string): Promise<void> {
    const res = await fetch(`${baseUrl}/sessions/${id}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new ApiError(`Запит DELETE /sessions/${id} повернув ${res.status}`, res.status);
    }
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
};
