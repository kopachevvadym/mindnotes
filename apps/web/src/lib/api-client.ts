import { z } from "zod";
import { sessionDetailSchema, type SessionDetail } from "@mindnotes/schema";

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
async function request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "application/json" },
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
};
