import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { activeSpanQuery, sessionQuery, spansQuery } from "@/lib/queries";
import { pluralThoughts } from "@/lib/format";
import { SessionHeader } from "@/components/session/SessionHeader";
import { ThoughtStream } from "@/components/session/ThoughtStream";
import { CaptureBar } from "@/components/session/CaptureBar";

interface SessionPageProps {
  sessionId: string;
}

export function SessionPage({ sessionId }: SessionPageProps) {
  const { data, isPending, isError, error } = useQuery(sessionQuery(sessionId));

  // Фокус поля захоплення приглушує потік.
  const [isCapturing, setIsCapturing] = useState(false);

  // Інтервали читання ЦІЄЇ сесії (привʼязані за session_id) — будь-якого дня.
  // Активний домішуємо, лише якщо він належить цій сесії (миттєва «читання триває»
  // ще до реконсайлу списку).
  const { data: ownSpans = [] } = useQuery(spansQuery(sessionId));
  const { data: activeData } = useQuery(activeSpanQuery());
  const active = activeData?.span ?? null;
  const spans =
    active && active.sessionId === sessionId && !ownSpans.some((s) => s.id === active.id)
      ? [...ownSpans, active].sort(
          (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
        )
      : ownSpans;

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
  // Нерозібрані: активні думки поза будь-якою групою — кандидати на розбір.
  const unsortedCount = thoughts.filter((t) => !t.archived && t.contextId === null).length;

  return (
    <div className="flex flex-1 flex-col">
      <SessionHeader session={session} activeCount={activeCount} archivedCount={archivedCount} />

      <main className="flex-1 pt-6">
        {unsortedCount > 0 ? (
          <div className="flex justify-end pb-4">
            <Link
              to="/sessions/$sessionId/triage"
              params={{ sessionId }}
              className="font-sans text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              розібрати {pluralThoughts(unsortedCount)} →
            </Link>
          </div>
        ) : null}
        <ThoughtStream thoughts={thoughts} sessionId={sessionId} spans={spans} dimmed={isCapturing} />
      </main>

      <CaptureBar
        sessionId={sessionId}
        isEmptySession={isEmptySession}
        onFocusChange={setIsCapturing}
      />
    </div>
  );
}

function StatusNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-24 text-center font-serif text-lg italic text-muted-foreground">{children}</p>
  );
}
