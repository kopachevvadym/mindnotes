import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Archive, ArrowRight, Lightbulb, ListPlus } from "lucide-react";
import type { ContextListItem } from "@mindnotes/schema";
import { contextsQuery, sessionQuery } from "@/lib/queries";
import {
  useAddThoughtToContext,
  useCreateContext,
  useSetThoughtArchived,
} from "@/lib/mutations";
import { formatClockTime, minutesAgo, pluralThoughts, relativeThoughtTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddToContextPicker } from "@/components/session/AddToContextPicker";

interface TriagePageProps {
  sessionId: string;
}

/** Скільки груп показувати як швидкі кнопки (клавіші 1..N). */
const QUICK_PICKS = 5;

/**
 * Режим розбору: нерозібрані думки сесії (активні й поза групами) проходяться
 * по одній, як inbox. Черга — знімок на вході; кожна дія рухає вперед.
 * Клавіші: 1..5 — у групу, N — нова ідея, A — архів, пробіл/→ — пропустити,
 * Esc — назад у сесію.
 */
export function TriagePage({ sessionId }: TriagePageProps) {
  const navigate = useNavigate();
  const { data, isPending, isError, error } = useQuery(sessionQuery(sessionId));
  const { data: contexts = [] } = useQuery(contextsQuery());

  const addThought = useAddThoughtToContext(sessionId);
  const createContext = useCreateContext(sessionId);
  const setArchived = useSetThoughtArchived(sessionId);

  // Знімок черги на вході: живий перерахунок зіпсував би позицію під час дій.
  const [queue, setQueue] = useState<string[] | null>(null);
  const [idx, setIdx] = useState(0);
  // Нещодавно вжиті групи — наперед у швидких кнопках.
  const [mru, setMru] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (queue === null && data) {
      setQueue(
        data.thoughts.filter((t) => !t.archived && t.contextId === null).map((t) => t.id),
      );
    }
  }, [data, queue]);

  const total = queue?.length ?? 0;
  const done = queue !== null && idx >= total;
  const currentId = queue && idx < total ? queue[idx] : undefined;
  const current = currentId ? data?.thoughts.find((t) => t.id === currentId) : undefined;

  // Думка з черги зникла з даних (видалена деінде) — пропускаємо її. Функціональний
  // апдейт із перевіркою робить ефект ідемпотентним (StrictMode-safe).
  useEffect(() => {
    if (queue !== null && currentId && data && !data.thoughts.some((t) => t.id === currentId)) {
      setIdx((i) => (queue[i] === currentId ? i + 1 : i));
    }
  }, [queue, currentId, data]);

  const quickPicks: ContextListItem[] = useMemo(() => {
    const byId = new Map(contexts.map((c) => [c.id, c]));
    const recent = mru
      .map((id) => byId.get(id))
      .filter((c): c is ContextListItem => c !== undefined);
    const rest = contexts.filter((c) => !mru.includes(c.id));
    return [...recent, ...rest].slice(0, QUICK_PICKS);
  }, [contexts, mru]);

  function pushMru(contextId: string) {
    setMru((prev) => [contextId, ...prev.filter((id) => id !== contextId)]);
  }

  function advance() {
    setIdx((i) => i + 1);
  }

  function assign(contextId: string) {
    if (!current) return;
    addThought.mutate({ contextId, thoughtId: current.id });
    pushMru(contextId);
    advance();
  }

  function createNew() {
    if (!current) return;
    createContext.mutate(
      { seedThoughtId: current.id },
      { onSuccess: (detail) => pushMru(detail.context.id) },
    );
    advance();
  }

  function archive() {
    if (!current) return;
    setArchived.mutate({ id: current.id, archived: true });
    advance();
  }

  function goBack() {
    void navigate({ to: "/sessions/$sessionId", params: { sessionId } });
  }

  // Клавіші працюють, коли є поточна думка й пікер закритий. e.code — layout-незалежно.
  useEffect(() => {
    if (!current || pickerOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // Не перехоплюємо ввід: фокус у полі (палітра пошуку тощо) чи відкритий діалог.
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, [contenteditable='true'], [role='dialog']")
      ) {
        return;
      }
      if (event.code.startsWith("Digit")) {
        const n = Number(event.code.slice(5));
        const pick = quickPicks[n - 1];
        if (pick) {
          event.preventDefault();
          assign(pick.id);
        }
      } else if (event.code === "KeyN") {
        event.preventDefault();
        createNew();
      } else if (event.code === "KeyA") {
        event.preventDefault();
        archive();
      } else if (event.code === "Space" || event.code === "ArrowRight") {
        event.preventDefault();
        advance();
      } else if (event.code === "Escape") {
        event.preventDefault();
        goBack();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (isPending) {
    return <StatusNote>Завантаження…</StatusNote>;
  }
  if (isError) {
    return <StatusNote>Не вдалося завантажити сесію: {error.message}</StatusNote>;
  }

  return (
    <div className="flex flex-1 flex-col pb-16">
      <header className="flex items-baseline justify-between gap-4 pt-8 pb-4">
        <Link
          to="/sessions/$sessionId"
          params={{ sessionId }}
          className="font-sans text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          ← До сесії
        </Link>
        {total > 0 && !done ? (
          <p className="font-mono text-xs text-muted-foreground">
            {idx + 1} із {total}
          </p>
        ) : null}
      </header>

      {queue === null ? (
        <StatusNote>Завантаження…</StatusNote>
      ) : total === 0 ? (
        <StatusNote>
          Тут нема чого розбирати — всі думки вже в ідеях або в архіві.
        </StatusNote>
      ) : done ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
          <p className="font-serif text-2xl text-foreground">Все розібрано.</p>
          <p className="font-sans text-sm text-muted-foreground">
            {pluralThoughts(total)} оброблено.
          </p>
          <Link
            to="/contexts"
            className="font-sans text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            До ідей →
          </Link>
        </div>
      ) : current ? (
        <>
          <div className="rounded-2xl border border-border bg-paper p-6 shadow-sm">
            <p className="whitespace-pre-wrap font-serif text-xl leading-relaxed text-foreground">
              {current.body}
            </p>
            <p className="mt-3 font-mono text-[11px] tracking-wide text-muted-foreground/60">
              {relativeThoughtTime(minutesAgo(current.createdAt), formatClockTime(current.createdAt))}
            </p>
          </div>

          <section className="mt-6">
            {quickPicks.length > 0 ? (
              <>
                <h2 className="px-1 pb-1 font-sans text-xs uppercase tracking-wide text-muted-foreground">
                  У групу
                </h2>
                <ol className="flex flex-col">
                  {quickPicks.map((context, i) => (
                    <li key={context.id}>
                      <button
                        type="button"
                        onClick={() => assign(context.id)}
                        className="flex w-full items-baseline gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent/50"
                      >
                        <kbd className="shrink-0 font-mono text-xs text-muted-foreground/60">
                          {i + 1}
                        </kbd>
                        <span
                          className={cn(
                            "line-clamp-1 font-serif text-base leading-snug",
                            context.thesis
                              ? "text-foreground"
                              : "italic text-muted-foreground",
                          )}
                        >
                          {context.thesis ?? context.previewBody ?? "Без назви"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 px-1 pt-4">
              <TriageAction icon={Lightbulb} label="Нова ідея" kbd="N" onClick={createNew} />
              <TriageAction
                icon={ListPlus}
                label="Інша…"
                kbd={null}
                onClick={() => setPickerOpen(true)}
              />
              <TriageAction icon={Archive} label="В архів" kbd="A" onClick={archive} />
              <TriageAction icon={ArrowRight} label="Пропустити" kbd="⎵" onClick={advance} />
            </div>
          </section>

          <AddToContextPicker
            sessionId={sessionId}
            thoughtId={pickerOpen ? current.id : null}
            onClose={() => setPickerOpen(false)}
            onPicked={(contextId) => {
              pushMru(contextId);
              advance();
            }}
          />
        </>
      ) : null}
    </div>
  );
}

/** Тиха кнопка дії з підписом-клавішею. */
function TriageAction({
  icon: Icon,
  label,
  kbd,
  onClick,
}: {
  icon: typeof Lightbulb;
  label: string;
  kbd: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 font-sans text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <Icon className="size-4" aria-hidden />
      {label}
      {kbd ? <kbd className="font-mono text-xs text-muted-foreground/50">{kbd}</kbd> : null}
    </button>
  );
}

function StatusNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-24 text-center font-serif text-lg italic text-muted-foreground">{children}</p>
  );
}
