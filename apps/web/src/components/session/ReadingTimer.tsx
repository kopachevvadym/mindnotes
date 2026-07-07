import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { activeSpanQuery } from "@/lib/queries";
import { useStartSpan, useStopSpan } from "@/lib/mutations";
import { formatTimerClock } from "@/lib/format";

/**
 * Кнопка таймера читання в шапці сесії: старт і стоп — ОДНЕ місце.
 * Неактивний — тиха іконка книги; активний — живий лічильник від started_at + стоп.
 * Стан переживає рефреш через GET /reading-spans/active; лічильник — локальний тік,
 * без полінгу сервера.
 */
export function ReadingTimer({ sessionId }: { sessionId: string }) {
  const { data } = useQuery(activeSpanQuery());
  const span = data?.span ?? null;
  const startSpan = useStartSpan();
  const stopSpan = useStopSpan();
  const [toast, setToast] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Тік щосекунди — лише поки читання триває.
  useEffect(() => {
    if (!span) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [span?.id]);

  // Тихий тост зникає сам.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2_500);
    return () => clearTimeout(id);
  }, [toast]);

  function stop() {
    stopSpan.mutate(undefined, {
      onSuccess: (result) => {
        if (result.discarded) setToast("Коротке читання не збережено");
      },
    });
  }

  return (
    <>
      {span ? (
        <button
          type="button"
          onClick={stop}
          disabled={stopSpan.isPending}
          aria-label="Зупинити читання"
          title="Зупинити читання"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2 font-mono text-sm tabular-nums text-primary transition-colors hover:bg-accent disabled:opacity-50"
        >
          <Square className="size-3 fill-current" aria-hidden />
          {formatTimerClock(nowMs - new Date(span.startedAt).getTime())}
        </button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Почати читання"
          title="Почати читання"
          onClick={() => startSpan.mutate(sessionId)}
          disabled={startSpan.isPending}
          className="shrink-0 text-muted-foreground"
        >
          <BookOpen />
        </Button>
      )}

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-5">
          <span className="rounded-full border border-border bg-paper px-4 py-2 font-sans text-sm text-muted-foreground shadow-md">
            {toast}
          </span>
        </div>
      ) : null}
    </>
  );
}
