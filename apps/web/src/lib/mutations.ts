import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SessionDetail, ThoughtDto } from "@mindnotes/schema";
import { api } from "./api-client";
import { sessionQuery } from "./queries";

interface CreateThoughtContext {
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

  return useMutation<ThoughtDto, Error, string, CreateThoughtContext>({
    mutationFn: (body) => api.createThought(sessionId, { body }),

    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SessionDetail>(queryKey);

      const optimistic: ThoughtDto = {
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
    CreateThoughtContext
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
