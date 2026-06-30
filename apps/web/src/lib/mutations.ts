import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { IdeaDetail, IdeaDto, SessionDetail, SessionDto, ThoughtDto } from "@mindnotes/schema";
import { api } from "./api-client";
import { ideaQuery, ideasQuery, sessionQuery, sessionsQuery } from "./queries";

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
        ideaId: null,
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

/**
 * Редагування тіла думки (лише в межах вікна) з оптимістичним оновленням у кеші сесії.
 * onError — відкат; onSettled — реконсайл.
 */
export function useEditThought(sessionId: string) {
  const queryClient = useQueryClient();
  const { queryKey } = sessionQuery(sessionId);

  return useMutation<ThoughtDto, Error, { id: string; body: string }, SessionCacheContext>({
    mutationFn: ({ id, body }) => api.updateThought(id, { body }),

    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SessionDetail>(queryKey);

      queryClient.setQueryData<SessionDetail>(queryKey, (old) =>
        old
          ? {
              ...old,
              thoughts: old.thoughts.map((t) => (t.id === id ? { ...t, body } : t)),
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

/**
 * Видалення думки (лише в межах вікна) з оптимістичним прибиранням із кешу сесії.
 * onError — відкат; onSettled — реконсайл.
 */
export function useDeleteThought(sessionId: string) {
  const queryClient = useQueryClient();
  const { queryKey } = sessionQuery(sessionId);

  return useMutation<void, Error, string, SessionCacheContext>({
    mutationFn: (id) => api.deleteThought(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SessionDetail>(queryKey);

      queryClient.setQueryData<SessionDetail>(queryKey, (old) =>
        old ? { ...old, thoughts: old.thoughts.filter((t) => t.id !== id) } : old,
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

/**
 * Народження ідеї з думки-насінини. id нової ідеї відомий лише з відповіді, тож мітку-двері
 * (ideaId) ставимо в onSuccess; onSettled — реконсайл сесії із сервером.
 */
export function useCreateIdea(sessionId: string) {
  const queryClient = useQueryClient();
  const { queryKey } = sessionQuery(sessionId);

  return useMutation<IdeaDetail, Error, { seedThoughtId: string }>({
    mutationFn: ({ seedThoughtId }) => api.createIdea({ seedThoughtId }),

    onSuccess: (data, { seedThoughtId }) => {
      queryClient.setQueryData<SessionDetail>(queryKey, (old) =>
        old
          ? {
              ...old,
              thoughts: old.thoughts.map((t) =>
                t.id === seedThoughtId ? { ...t, ideaId: data.idea.id } : t,
              ),
            }
          : old,
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

/**
 * Оновлення тези ідеї з оптимістичним оновленням у кеші сторінки ідеї.
 * onError — відкат; onSettled — реконсайл сторінки та списку.
 */
export function useUpdateIdea(ideaId: string) {
  const queryClient = useQueryClient();
  const { queryKey } = ideaQuery(ideaId);

  return useMutation<IdeaDto, Error, { thesis: string | null }, { previous: IdeaDetail | undefined }>({
    mutationFn: ({ thesis }) => api.updateIdea(ideaId, { thesis }),

    onMutate: async ({ thesis }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<IdeaDetail>(queryKey);

      queryClient.setQueryData<IdeaDetail>(queryKey, (old) =>
        old ? { ...old, idea: { ...old.idea, thesis } } : old,
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
      void queryClient.invalidateQueries({ queryKey: ideasQuery().queryKey });
    },
  });
}

/**
 * Втягування НАЯВНОЇ думки в НАЯВНУ ідею. Оптимістично: якщо думка ще без ідеї —
 * ставимо ideaId (зʼявляється мітка-двері). onSettled — реконсайл сесії, ідеї та списку.
 */
export function useAddThoughtToIdea(sessionId: string) {
  const queryClient = useQueryClient();
  const { queryKey } = sessionQuery(sessionId);

  return useMutation<IdeaDetail, Error, { ideaId: string; thoughtId: string }, SessionCacheContext>({
    mutationFn: ({ ideaId, thoughtId }) => api.addThoughtToIdea(ideaId, { thoughtId }),

    onMutate: async ({ ideaId, thoughtId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SessionDetail>(queryKey);

      queryClient.setQueryData<SessionDetail>(queryKey, (old) =>
        old
          ? {
              ...old,
              thoughts: old.thoughts.map((t) =>
                t.id === thoughtId ? { ...t, ideaId: t.ideaId ?? ideaId } : t,
              ),
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

    onSettled: (_data, _error, { ideaId }) => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ideaQuery(ideaId).queryKey });
      void queryClient.invalidateQueries({ queryKey: ideasQuery().queryKey });
    },
  });
}

/**
 * Відчеплення думки від ідеї (сама думка лишається в потоці). Оптимістично прибираємо
 * думку з кешу сторінки ідеї. onError — відкат; onSettled — реконсайл ідеї та списку.
 */
export function useRemoveThoughtFromIdea(ideaId: string) {
  const queryClient = useQueryClient();
  const { queryKey } = ideaQuery(ideaId);

  return useMutation<void, Error, { thoughtId: string }, { previous: IdeaDetail | undefined }>({
    mutationFn: ({ thoughtId }) => api.removeThoughtFromIdea(ideaId, thoughtId),

    onMutate: async ({ thoughtId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<IdeaDetail>(queryKey);

      queryClient.setQueryData<IdeaDetail>(queryKey, (old) =>
        old ? { ...old, thoughts: old.thoughts.filter((t) => t.id !== thoughtId) } : old,
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
      void queryClient.invalidateQueries({ queryKey: ideasQuery().queryKey });
    },
  });
}

/**
 * Видалення ідеї (думки лишаються в потоці). Після успіху — навігація в список ідей.
 */
export function useDeleteIdea() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<void, Error, string>({
    mutationFn: (id) => api.deleteIdea(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ideasQuery().queryKey });
      void navigate({ to: "/ideas" });
    },
  });
}
