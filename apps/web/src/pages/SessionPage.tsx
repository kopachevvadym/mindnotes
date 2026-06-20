import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sessionQuery } from "@/lib/queries";
import { SessionHeader } from "@/components/session/SessionHeader";
import { ThoughtStream } from "@/components/session/ThoughtStream";
import { CaptureBar } from "@/components/session/CaptureBar";

interface SessionPageProps {
  sessionId: string;
}

export function SessionPage({ sessionId }: SessionPageProps) {
  const { data, isPending, isError, error } = useQuery(sessionQuery(sessionId));
  // Поле захоплення у фокусі → приглушуємо потік (фокус уперед).
  const [isCapturing, setIsCapturing] = useState(false);

  if (isPending) {
    return <StatusNote>Завантаження…</StatusNote>;
  }

  if (isError) {
    return <StatusNote>Не вдалося завантажити сесію: {error.message}</StatusNote>;
  }

  const { session, thoughts } = data;
  const activeCount = thoughts.filter((t) => !t.archived).length;
  const archivedCount = thoughts.length - activeCount;

  return (
    <div className="flex flex-1 flex-col">
      <SessionHeader session={session} activeCount={activeCount} archivedCount={archivedCount} />

      <main className="flex-1 pt-10">
        <ThoughtStream thoughts={thoughts} sessionId={sessionId} dimmed={isCapturing} />
      </main>

      <CaptureBar sessionId={sessionId} onFocusChange={setIsCapturing} />
    </div>
  );
}

function StatusNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-24 text-center font-serif text-lg italic text-muted-foreground">{children}</p>
  );
}
