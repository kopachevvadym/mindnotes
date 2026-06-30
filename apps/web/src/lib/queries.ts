import { queryOptions } from "@tanstack/react-query";
import { api } from "./api-client";

/** Усі query йдуть лише крізь api-клієнт. */
export const sessionsQuery = () =>
  queryOptions({
    queryKey: ["sessions"],
    queryFn: () => api.getSessions(),
  });

export const sessionQuery = (id: string) =>
  queryOptions({
    queryKey: ["session", id],
    queryFn: () => api.getSession(id),
  });
