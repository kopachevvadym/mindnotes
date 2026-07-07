import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type {
  ContextDetail,
  ContextDto,
  ReadingSpanDto,
  SessionDetail,
  SessionDto,
  StopReadingSpanResult,
  ThoughtDto,
  UpdateReadingSpanInput,
} from "@mindnotes/schema";
import { api, ApiError } from "./api-client";
import {
  activeSpanQuery,
  contextQuery,
  contextsQuery,
  sessionQuery,
  sessionsQuery,
} from "./queries";

/** Часткий ключ усіх діапазонних кешів спанів (["reading-spans","list", from]). */
const SPANS_LIST_KEY = ["reading-spans", "list"] as const;

interface SessionCacheContext {
  previous: SessionDetail | undefined;
}

/**
 * Захоплення думки з оптимістичним оновленням. Думка одразу зʼявляється в кінці
 * потоку (хронологія: найновіше внизу), щоб захоплення відчувалося миттєвим.
 * Мережеві/серверні збої тихо ретраяться двічі — користувач дивиться в книжку,
 * а не на екран. onError — відкат; onSettled — реконсайл зі справжнім id/часом.
 */
export function useCreateThought(sessionId: string) {
  const queryClient = useQueryClient();
  const { queryKey } = sessionQuery(sessionId);

  return useMutation<ThoughtDto, Error, string, SessionCacheContext>({
    mutationFn: (body) => api.createThought(sessionId, { body }),

    // 4xx не ретраїмо — це помилка запиту, а не збій.
    retry: (failureCount, error) =>
      failureCount < 2 && (!(error instanceof ApiError) || error.status >= 500),

    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SessionDetail>(queryKey);

      const optimistic: SessionDetail["thoughts"][number] = {
        id: crypto.randomUUID(),
        sessionId,
        body,
        archived: false,
        createdAt: new Date().toISOString(),
        contextId: null,
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
 * (contextId) ставимо в onSuccess; onSettled — реконсайл сесії із сервером.
 */
export function useCreateContext(sessionId: string) {
  const queryClient = useQueryClient();
  const { queryKey } = sessionQuery(sessionId);

  return useMutation<ContextDetail, Error, { seedThoughtId: string }>({
    mutationFn: ({ seedThoughtId }) => api.createContext({ seedThoughtId }),

    onSuccess: (data, { seedThoughtId }) => {
      queryClient.setQueryData<SessionDetail>(queryKey, (old) =>
        old
          ? {
              ...old,
              thoughts: old.thoughts.map((t) =>
                t.id === seedThoughtId ? { ...t, contextId: data.context.id } : t,
              ),
            }
          : old,
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      // Нова група мусить одразу зʼявитись у списках (зокрема у швидких кнопках розбору).
      void queryClient.invalidateQueries({ queryKey: contextsQuery().queryKey });
    },
  });
}

/**
 * Оновлення тези ідеї з оптимістичним оновленням у кеші сторінки ідеї.
 * onError — відкат; onSettled — реконсайл сторінки та списку.
 */
export function useUpdateContext(contextId: string) {
  const queryClient = useQueryClient();
  const { queryKey } = contextQuery(contextId);

  return useMutation<ContextDto, Error, { thesis: string | null }, { previous: ContextDetail | undefined }>({
    mutationFn: ({ thesis }) => api.updateContext(contextId, { thesis }),

    onMutate: async ({ thesis }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ContextDetail>(queryKey);

      queryClient.setQueryData<ContextDetail>(queryKey, (old) =>
        old ? { ...old, context: { ...old.context, thesis } } : old,
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
      void queryClient.invalidateQueries({ queryKey: contextsQuery().queryKey });
    },
  });
}

/**
 * Втягування НАЯВНОЇ думки в НАЯВНУ ідею. Оптимістично: якщо думка ще без ідеї —
 * ставимо contextId (зʼявляється мітка-двері). onSettled — реконсайл сесії, ідеї та списку.
 */
export function useAddThoughtToContext(sessionId: string) {
  const queryClient = useQueryClient();
  const { queryKey } = sessionQuery(sessionId);

  return useMutation<ContextDetail, Error, { contextId: string; thoughtId: string }, SessionCacheContext>({
    mutationFn: ({ contextId, thoughtId }) => api.addThoughtToContext(contextId, { thoughtId }),

    onMutate: async ({ contextId, thoughtId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SessionDetail>(queryKey);

      queryClient.setQueryData<SessionDetail>(queryKey, (old) =>
        old
          ? {
              ...old,
              thoughts: old.thoughts.map((t) =>
                t.id === thoughtId ? { ...t, contextId: t.contextId ?? contextId } : t,
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

    onSettled: (_data, _error, { contextId }) => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: contextQuery(contextId).queryKey });
      void queryClient.invalidateQueries({ queryKey: contextsQuery().queryKey });
    },
  });
}

/**
 * Відчеплення думки від ідеї (сама думка лишається в потоці). Оптимістично прибираємо
 * думку з кешу сторінки ідеї. onError — відкат; onSettled — реконсайл ідеї та списку.
 */
export function useRemoveThoughtFromContext(contextId: string) {
  const queryClient = useQueryClient();
  const { queryKey } = contextQuery(contextId);

  return useMutation<void, Error, { thoughtId: string }, { previous: ContextDetail | undefined }>({
    mutationFn: ({ thoughtId }) => api.removeThoughtFromContext(contextId, thoughtId),

    onMutate: async ({ thoughtId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ContextDetail>(queryKey);

      queryClient.setQueryData<ContextDetail>(queryKey, (old) =>
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
      void queryClient.invalidateQueries({ queryKey: contextsQuery().queryKey });
    },
  });
}

/**
 * Видалення ідеї (думки лишаються в потоці). Після успіху — навігація в список ідей.
 */
export function useDeleteContext() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<void, Error, string>({
    mutationFn: (id) => api.deleteContext(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contextsQuery().queryKey });
      void navigate({ to: "/contexts" });
    },
  });
}

/**
 * Старт читання. Ідемпотентний на бекенді (повторний старт повертає активний спан),
 * тож без оптимізму: кладемо відповідь у кеш активного і реконсайлимо список.
 */
export function useStartSpan() {
  const queryClient = useQueryClient();

  return useMutation<ReadingSpanDto, Error, string | undefined>({
    mutationFn: (sessionId) => api.startReadingSpan(sessionId),
    onSuccess: (span) => {
      queryClient.setQueryData(activeSpanQuery().queryKey, { span });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SPANS_LIST_KEY });
      void queryClient.invalidateQueries({ queryKey: activeSpanQuery().queryKey });
    },
  });
}

/**
 * Стоп читання. Відповідь несе discarded (коротке читання видалено) — рішення про тост
 * ухвалює компонент. Кеш активного чистимо одразу, список — реконсайл.
 */
export function useStopSpan() {
  const queryClient = useQueryClient();

  return useMutation<StopReadingSpanResult, Error, void>({
    mutationFn: () => api.stopReadingSpan(),
    onSuccess: () => {
      queryClient.setQueryData(activeSpanQuery().queryKey, { span: null });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SPANS_LIST_KEY });
      void queryClient.invalidateQueries({ queryKey: activeSpanQuery().queryKey });
    },
  });
}

interface SpansCacheContext {
  previous: Array<[readonly unknown[], ReadingSpanDto[] | undefined]>;
}

/**
 * Редагування меж інтервалу з оптимістичним оновленням в УСІХ діапазонних кешах
 * (ключі відрізняються за from). onError — відкат; onSettled — реконсайл.
 */
export function useUpdateSpan() {
  const queryClient = useQueryClient();

  return useMutation<ReadingSpanDto, Error, { id: string } & UpdateReadingSpanInput, SpansCacheContext>({
    mutationFn: ({ id, ...input }) => api.updateReadingSpan(id, input),

    onMutate: async ({ id, startedAt, endedAt }) => {
      await queryClient.cancelQueries({ queryKey: SPANS_LIST_KEY });
      const previous = queryClient.getQueriesData<ReadingSpanDto[]>({ queryKey: SPANS_LIST_KEY });

      queryClient.setQueriesData<ReadingSpanDto[]>({ queryKey: SPANS_LIST_KEY }, (old) =>
        old?.map((s) =>
          s.id === id
            ? { ...s, startedAt: startedAt ?? s.startedAt, endedAt: endedAt ?? s.endedAt }
            : s,
        ),
      );

      return { previous };
    },

    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SPANS_LIST_KEY });
    },
  });
}

/**
 * Видалення інтервалу (думки лишаються в потоці) з оптимістичним прибиранням
 * з усіх діапазонних кешів. onError — відкат; onSettled — реконсайл.
 */
export function useDeleteSpan() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, SpansCacheContext>({
    mutationFn: (id) => api.deleteReadingSpan(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: SPANS_LIST_KEY });
      const previous = queryClient.getQueriesData<ReadingSpanDto[]>({ queryKey: SPANS_LIST_KEY });

      queryClient.setQueriesData<ReadingSpanDto[]>({ queryKey: SPANS_LIST_KEY }, (old) =>
        old?.filter((s) => s.id !== id),
      );

      return { previous };
    },

    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SPANS_LIST_KEY });
      void queryClient.invalidateQueries({ queryKey: activeSpanQuery().queryKey });
    },
  });
}
