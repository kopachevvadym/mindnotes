import { z } from "zod";
import {
  sessionDetailSchema,
  thoughtDtoSchema,
  type SessionDetail,
  type ThoughtDto,
  type CreateThoughtInput,
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
};
