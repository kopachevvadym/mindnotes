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

export const contextsQuery = () =>
  queryOptions({
    queryKey: ["contexts"],
    queryFn: () => api.getContexts(),
  });

export const contextQuery = (id: string) =>
  queryOptions({
    queryKey: ["context", id],
    queryFn: () => api.getContext(id),
  });
