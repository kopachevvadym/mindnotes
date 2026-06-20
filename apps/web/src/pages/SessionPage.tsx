import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sessionQuery, contextsQuery } from "@/lib/queries";
import {
  useAssignThoughts,
  useCreateContext,
  useRemoveThoughtFromContext,
} from "@/lib/mutations";
import { SessionHeader, type SessionMode } from "@/components/session/SessionHeader";
import { ThoughtStream } from "@/components/session/ThoughtStream";
import { CaptureBar } from "@/components/session/CaptureBar";
import { ContextChips } from "@/components/session/ContextChips";
import { SynthesisAssignBar } from "@/components/session/SynthesisAssignBar";
import type { SessionThoughtDto } from "@mindnotes/schema";

interface SessionPageProps {
  sessionId: string;
}

export function SessionPage({ sessionId }: SessionPageProps) {
  const { data, isPending, isError, error } = useQuery(sessionQuery(sessionId));

  // Режим сторінки — локальний стан (НЕ zustand).
  const [mode, setMode] = useState<SessionMode>("flow");
  // Потік: фокус поля захоплення приглушує потік.
  const [isCapturing, setIsCapturing] = useState(false);
  // Синтез: вибір думок + сфокусований контекст.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedContextId, setFocusedContextId] = useState<string | null>(null);

  const { data: contexts = [] } = useQuery({
    ...contextsQuery(),
    enabled: mode === "synthesis",
  });

  const createContext = useCreateContext();
  const assignThoughts = useAssignThoughts(sessionId);
  const removeThought = useRemoveThoughtFromContext(sessionId);

  function changeMode(next: SessionMode) {
    setMode(next);
    setSelectedIds(new Set());
    setFocusedContextId(null);
  }

  function focusContext(id: string) {
    setFocusedContextId((prev) => (prev === id ? null : id));
    setSelectedIds(new Set()); // фокус і вибір — взаємовиключні
  }

  function onThoughtTap(thought: SessionThoughtDto) {
    if (focusedContextId) {
      // Тап по підсвіченій (члену) — прибрати з контексту.
      if (thought.contextIds.includes(focusedContextId)) {
        removeThought.mutate({ contextId: focusedContextId, thoughtId: thought.id });
      }
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(thought.id)) next.delete(thought.id);
      else next.add(thought.id);
      return next;
    });
  }

  async function assignExisting(contextId: string) {
    await assignThoughts.mutateAsync({ contextId, thoughtIds: [...selectedIds] });
    setSelectedIds(new Set());
  }

  async function assignNew(name: string, emoji: string) {
    const context = await createContext.mutateAsync({ name, emoji });
    await assignThoughts.mutateAsync({ contextId: context.id, thoughtIds: [...selectedIds] });
    setSelectedIds(new Set());
  }

  if (isPending) {
    return <StatusNote>Завантаження…</StatusNote>;
  }

  if (isError) {
    return <StatusNote>Не вдалося завантажити сесію: {error.message}</StatusNote>;
  }

  const { session, thoughts } = data;
  const activeCount = thoughts.filter((t) => !t.archived).length;
  const archivedCount = thoughts.length - activeCount;
  const isEmptySession = session.title === null && thoughts.length === 0;
  const isSynthesis = mode === "synthesis";
  const focusedContext = focusedContextId
    ? (contexts.find((c) => c.id === focusedContextId) ?? null)
    : null;

  return (
    <div className="flex flex-1 flex-col">
      <SessionHeader
        session={session}
        activeCount={activeCount}
        archivedCount={archivedCount}
        mode={mode}
        onModeChange={changeMode}
      />

      {isSynthesis ? (
        <ContextChips contexts={contexts} focusedId={focusedContextId} onFocus={focusContext} />
      ) : null}

      <main className="flex-1 pt-6">
        <ThoughtStream
          thoughts={thoughts}
          sessionId={sessionId}
          dimmed={!isSynthesis && isCapturing}
          mode={mode}
          selectedIds={selectedIds}
          focusedContext={focusedContext}
          onThoughtTap={onThoughtTap}
        />
      </main>

      {isSynthesis ? (
        selectedIds.size > 0 ? (
          <SynthesisAssignBar
            contexts={contexts}
            selectedCount={selectedIds.size}
            busy={assignThoughts.isPending || createContext.isPending}
            onAssignExisting={assignExisting}
            onAssignNew={assignNew}
          />
        ) : null
      ) : (
        <CaptureBar
          sessionId={sessionId}
          isEmptySession={isEmptySession}
          onFocusChange={setIsCapturing}
        />
      )}
    </div>
  );
}

function StatusNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-24 text-center font-serif text-lg italic text-muted-foreground">{children}</p>
  );
}
