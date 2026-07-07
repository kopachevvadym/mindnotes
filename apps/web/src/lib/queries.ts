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

export const searchQuery = (q: string) =>
  queryOptions({
    queryKey: ["search", q],
    queryFn: () => api.search(q),
  });

/** Активний читацький інтервал (стан кнопки таймера; переживає рефреш). */
export const activeSpanQuery = () =>
  queryOptions({
    queryKey: ["reading-spans", "active"],
    queryFn: () => api.getActiveReadingSpan(),
  });

/** Інтервали читання, привʼязані до сесії (для рендера груп у потоці). */
export const spansQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ["reading-spans", "list", sessionId],
    queryFn: () => api.getReadingSpans(sessionId),
  });
