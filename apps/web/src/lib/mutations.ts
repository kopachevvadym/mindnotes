import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { SessionDetail, SessionDto, ThoughtDto } from "@mindnotes/schema";
import { api } from "./api-client";
import { sessionQuery, sessionsQuery } from "./queries";

interface SessionCacheContext {
  previous: SessionDetail | undefined;
}

/**
 * Захоплення думки з оптимістичним оновленням. Думка одразу зʼявляється в кінці
 * потоку (хронологія: найновіше внизу), щоб захоплення відчувалося миттєвим.
 * onError — відкат; onSettled — реконсайл зі справжнім id/часом із бекенда.
 */
export function useCreateThought(sessionId: string) {
  const queryClient = useQueryClient();
  const { queryKey } = sessionQuery(sessionId);

  return useMutation<ThoughtDto, Error, string, SessionCacheContext>({
    mutationFn: (body) => api.createThought(sessionId, { body }),

    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SessionDetail>(queryKey);

      const optimistic: SessionDetail["thoughts"][number] = {
        id: crypto.randomUUID(),
        sessionId,
        body,
        archived: false,
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<SessionDetail>(queryKey, (old) =>
        old ? { ...old, thoughts: [...old.thoughts, optimistic] } : old,
      );

      return { previous };
    },

    onError: (_error, _body, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

/**
 * Створення нової (порожньої) сесії: інвалідуємо список і одразу навігуємо в неї,
 * щоб користувач опинився в порожньому стані й почав писати.
 */
export function useCreateSession() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<SessionDto, Error, void>({
    mutationFn: () => api.createSession(),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: sessionsQuery().queryKey });
      void navigate({ to: "/sessions/$sessionId", params: { sessionId: session.id } });
    },
  });
}

/**
 * Видалення сесії (інвалідація списку). Використовується для прибирання порожньої
 * сесії, яку покинули без назви й без думок.
 */
export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => api.deleteSession(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionsQuery().queryKey });
    },
  });
}

/**
 * Перейменування сесії з оптимістичним оновленням назви в кеші сесії.
 * onError — відкат; onSettled — реконсайл сесії та списку.
 */
export function useUpdateSession(sessionId: string) {
  const queryClient = useQueryClient();
  const { queryKey } = sessionQuery(sessionId);

  return useMutation<
    SessionDto,
    Error,
    { title: string | null },
    { previous: SessionDetail | undefined }
  >({
    mutationFn: ({ title }) => api.updateSession(sessionId, { title }),

    onMutate: async ({ title }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SessionDetail>(queryKey);

      queryClient.setQueryData<SessionDetail>(queryKey, (old) =>
        old ? { ...old, session: { ...old.session, title } } : old,
      );

      return { previous };
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: sessionsQuery().queryKey });
    },
  });
}

/**
 * Архівування / розархівування думки з оптимістичним перемиканням `archived`:
 * думка миттєво сіріє/світлішає. onError — відкат; onSettled — реконсайл.
 */
export function useSetThoughtArchived(sessionId: string) {
  const queryClient = useQueryClient();
  const { queryKey } = sessionQuery(sessionId);

  return useMutation<
    ThoughtDto,
    Error,
    { id: string; archived: boolean },
    SessionCacheContext
  >({
    mutationFn: ({ id, archived }) => api.updateThought(id, { archived }),

    onMutate: async ({ id, archived }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SessionDetail>(queryKey);

      queryClient.setQueryData<SessionDetail>(queryKey, (old) =>
        old
          ? {
              ...old,
              thoughts: old.thoughts.map((t) => (t.id === id ? { ...t, archived } : t)),
            }
          : old,
      );

      return { previous };
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
