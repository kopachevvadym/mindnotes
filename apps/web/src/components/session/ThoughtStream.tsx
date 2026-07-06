import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Lightbulb, MoreVertical } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  THOUGHT_EDIT_WINDOW_MIN,
  type ReadingSpanDto,
  type SessionThoughtDto,
} from "@mindnotes/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCreateContext,
  useDeleteThought,
  useEditThought,
  useSetThoughtArchived,
} from "@/lib/mutations";
import {
  formatClockTime,
  formatDurationMin,
  formatFullDateTime,
  minutesAgo,
  minutesBetween,
  relativeThoughtTime,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddToContextPicker } from "./AddToContextPicker";
import { SpanEditor } from "./SpanEditor";

/** Поріг «відчутної» паузи між сусідніми думками (хвилини доби). */
const PAUSE_THRESHOLD_MIN = 15;

/** Хвилина доби: години*60 + хвилини — щоб різницю рахувати числом. */
function minuteOfDay(iso: string): number {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

interface PauseRow {
  thought: SessionThoughtDto;
  showPause: boolean;
  pauseLabel: string;
  /** Людський відносний підпис часу. */
  rel: string;
  /** Повний час для title-підказки. */
  fullTime: string;
}

/** Елемент таймлайна потоку: група-спан (з думками чи без) або одинока думка. */
type TimelineItem =
  | { kind: "span"; span: ReadingSpanDto; rows: PauseRow[]; t: number }
  | { kind: "thought"; row: PauseRow; t: number };

interface ThoughtStreamProps {
  thoughts: SessionThoughtDto[];
  sessionId: string;
  /** Читацькі інтервали, що перетинають потік (глобальні, без FK до сесії). */
  spans: ReadingSpanDto[];
  /** Приглушити потік, поки користувач пише (фокус уперед). */
  dimmed?: boolean;
}

export function ThoughtStream({ thoughts, sessionId, spans, dimmed = false }: ThoughtStreamProps) {
  const setArchived = useSetThoughtArchived(sessionId);
  const createContext = useCreateContext(sessionId);
  const editThought = useEditThought(sessionId);
  const deleteThought = useDeleteThought(sessionId);

  // Інлайн-редагування: id думки, що редагується, + чернетка тексту.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const editRef = useRef<HTMLTextAreaElement>(null);
  const skipBlur = useRef(false);
  // Пікер «у наявну ідею»: id думки, яку додаємо (null = закрито).
  const [pickerThoughtId, setPickerThoughtId] = useState<string | null>(null);
  // Редактор інтервалу читання (лише закриті спани; null = закрито).
  const [editingSpan, setEditingSpan] = useState<ReadingSpanDto | null>(null);

  // «Зараз» для активного спана: межа групи й підпис «триває · N хв». Тік раз на 30 с.
  const hasActiveSpan = spans.some((s) => s.endedAt === null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!hasActiveSpan) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [hasActiveSpan]);

  // Коли зʼявляється нова думка — доскролюємо до останньої (над баром захоплення).
  const prevCount = useRef(thoughts.length);
  useLayoutEffect(() => {
    if (thoughts.length > prevCount.current) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    }
    prevCount.current = thoughts.length;
  }, [thoughts.length]);

  // Фокус + курсор у кінець при старті редагування.
  useEffect(() => {
    if (editingId === null) return;
    const el = editRef.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, [editingId]);

  // Висота поля під вміст під час редагування.
  useLayoutEffect(() => {
    if (editingId === null) return;
    const el = editRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editingId, draft]);

  if (thoughts.length === 0 && spans.length === 0) {
    return (
      <p className="py-16 text-center font-serif text-lg italic text-muted-foreground">
        Тут поки порожньо. Перша думка — нижче.
      </p>
    );
  }

  function startEdit(thought: SessionThoughtDto) {
    setDraft(thought.body);
    setEditingId(thought.id);
  }

  function commitEdit() {
    if (skipBlur.current) {
      skipBlur.current = false;
      return;
    }
    const id = editingId;
    setEditingId(null);
    if (!id) return;
    const original = thoughts.find((t) => t.id === id)?.body;
    const next = draft.trim();
    if (next && next !== original) {
      editThought.mutate({ id, body: next });
    }
  }

  function cancelEdit() {
    skipBlur.current = true; // щоб Escape не комітив через onBlur
    setEditingId(null);
  }

  function handleEditKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commitEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  }

  // Модель рядків: проміжок паузи рахуємо тут, у шаблон віддаємо showPause + pauseLabel.
  const rows: PauseRow[] = thoughts.map((thought, i) => {
    const prev = i > 0 ? thoughts[i - 1] : undefined;
    const gap = prev ? minuteOfDay(thought.createdAt) - minuteOfDay(prev.createdAt) : 0;
    const showPause = gap >= PAUSE_THRESHOLD_MIN;
    const time = formatClockTime(thought.createdAt);
    const agoMin = minutesAgo(thought.createdAt);
    return {
      thought,
      showPause,
      pauseLabel: showPause ? `· тиша ${gap} хв ·` : "",
      rel: relativeThoughtTime(agoMin, time),
      fullTime: formatFullDateTime(thought.createdAt),
    };
  });

  // Таймлайн: думка «всередині» спана, якщо її created_at ∈ [started_at, ended_at].
  // Активний спан відкритий — його верхня межа ∞ (НЕ nowMs: тік раз на 30 с, і щойно
  // захоплена думка інакше випадала б із групи до наступного тіка).
  // Спани не перетинаються (бекенд відхиляє перетин), тож перший збіг і є домівкою думки.
  const rowsBySpan = new Map<string, PauseRow[]>();
  const loneRows: PauseRow[] = [];
  for (const row of rows) {
    const t = new Date(row.thought.createdAt).getTime();
    const home = spans.find((s) => {
      const started = new Date(s.startedAt).getTime();
      const ended = s.endedAt ? new Date(s.endedAt).getTime() : Infinity;
      return t >= started && t <= ended;
    });
    if (home) {
      const list = rowsBySpan.get(home.id) ?? [];
      list.push(row);
      rowsBySpan.set(home.id, list);
    } else {
      loneRows.push(row);
    }
  }

  const items: TimelineItem[] = [
    ...spans.map(
      (span): TimelineItem => ({
        kind: "span",
        span,
        rows: rowsBySpan.get(span.id) ?? [],
        t: new Date(span.startedAt).getTime(),
      }),
    ),
    ...loneRows.map(
      (row): TimelineItem => ({
        kind: "thought",
        row,
        t: new Date(row.thought.createdAt).getTime(),
      }),
    ),
  ].sort((a, b) => a.t - b.t);

  /**
   * Одна думка потоку — той самий рендер і в групі, і поза нею.
   * hidePause — для ПЕРШОЇ думки групи: її пауза виміряна до думки ПОЗА групою,
   * тож усередині рамки читання вона б хибно приписувала тишу інтервалу.
   */
  function renderThought({ thought, showPause, pauseLabel, rel, fullTime }: PauseRow, hidePause = false) {
    const isEditing = editingId === thought.id;
    // У межах вікна (від створення) думку ще можна редагувати/видалити.
    const editable = minutesAgo(thought.createdAt) < THOUGHT_EDIT_WINDOW_MIN;

    return (
      <Fragment key={thought.id}>
        {showPause && !hidePause ? <PauseMarker label={pauseLabel} /> : null}
        <li className="group flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <textarea
                ref={editRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={commitEdit}
                rows={1}
                aria-label="Редагувати думку"
                className="w-full resize-none overflow-hidden border-0 border-b border-border bg-transparent p-0 font-serif text-lg leading-relaxed text-foreground focus:outline-none"
              />
            ) : (
              <>
                <p
                  className={cn(
                    "select-text font-serif text-lg leading-relaxed transition-colors",
                    thought.archived
                      ? "whitespace-normal italic text-muted-foreground/70"
                      : "whitespace-pre-wrap text-foreground",
                  )}
                >
                  {thought.body}
                </p>
                {thought.contextId ? <ContextMark contextId={thought.contextId} /> : null}
                <ThoughtTime rel={rel} title={fullTime} />
              </>
            )}
          </div>

          {/* Тихі дії — лише в меню «⋮» */}
          {!isEditing ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Дії з думкою"
                className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent data-[state=open]:text-foreground"
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => createContext.mutate({ seedThoughtId: thought.id })}>
                  Нова ідея
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPickerThoughtId(thought.id)}>
                  У наявну ідею…
                </DropdownMenuItem>
                {editable ? (
                  <DropdownMenuItem onSelect={() => startEdit(thought)}>Редагувати</DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onSelect={() =>
                    setArchived.mutate({ id: thought.id, archived: !thought.archived })
                  }
                >
                  {thought.archived ? "Розархівувати" : "Архівувати"}
                </DropdownMenuItem>
                {editable ? (
                  <DropdownMenuItem
                    onSelect={() => deleteThought.mutate(thought.id)}
                    className="text-red-700 focus:text-red-700"
                  >
                    Видалити
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </li>
      </Fragment>
    );
  }

  /** Підпис інтервалу: «Читання · 14:07 · 43 хв»; активний — без тривалості в заголовку. */
  function spanLabel(span: ReadingSpanDto): string {
    const start = formatClockTime(span.startedAt);
    if (!span.endedAt) return `Читання · ${start}`;
    return `Читання · ${start} · ${formatDurationMin(minutesBetween(span.startedAt, span.endedAt))}`;
  }

  /** «читання триває · 12 хв» (без хвилин, поки не минула перша). */
  function activeLabel(span: ReadingSpanDto): string {
    const min = Math.floor((nowMs - new Date(span.startedAt).getTime()) / 60_000);
    return min >= 1 ? `читання триває · ${min} хв` : "читання триває";
  }

  function renderSpan(span: ReadingSpanDto, spanRows: PauseRow[]) {
    const isActive = span.endedAt === null;

    // Спан без думок цього потоку: тонкий рядок-роздільник на хронологічному місці.
    if (spanRows.length === 0) {
      return (
        <li key={`span-${span.id}`} className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          {isActive ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] text-primary/80">
              <span className="size-1.5 rounded-full bg-primary/70 motion-safe:animate-pulse" aria-hidden />
              {activeLabel(span)}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setEditingSpan(span)}
              className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {`Читання без нотаток · ${formatClockTime(span.startedAt)} · ${formatDurationMin(
                minutesBetween(span.startedAt, span.endedAt!),
              )}`}
            </button>
          )}
          <span className="h-px flex-1 bg-border" />
        </li>
      );
    }

    // Спан із думками: мʼяка група з тонкою лінією вздовж; активний — «відкритий» знизу.
    return (
      <li key={`span-${span.id}`}>
        <section
          className={cn(
            "-ml-3 border-l-2 pl-3 sm:-ml-4 sm:pl-4",
            isActive ? "border-primary/50" : "border-border",
          )}
        >
          {isActive ? (
            <p className="font-mono text-[10px] tracking-[0.15em] text-primary/80">
              {spanLabel(span)}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setEditingSpan(span)}
              className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {spanLabel(span)}
            </button>
          )}

          <ol className="mt-3 space-y-4">{spanRows.map((row, i) => renderThought(row, i === 0))}</ol>

          {isActive ? (
            <p className="mt-4 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] text-primary/80">
              <span className="size-1.5 rounded-full bg-primary/70 motion-safe:animate-pulse" aria-hidden />
              {activeLabel(span)}
            </p>
          ) : null}
        </section>
      </li>
    );
  }

  return (
    <>
      <ol
        className={cn(
          "space-y-4 transition-opacity duration-[180ms] ease-out motion-reduce:transition-none",
          dimmed ? "opacity-[0.7]" : "opacity-100",
        )}
      >
        {items.map((item) =>
          item.kind === "span" ? renderSpan(item.span, item.rows) : renderThought(item.row),
        )}
      </ol>
      <AddToContextPicker
        sessionId={sessionId}
        thoughtId={pickerThoughtId}
        onClose={() => setPickerThoughtId(null)}
      />
      <SpanEditor span={editingSpan} onClose={() => setEditingSpan(null)} />
    </>
  );
}

/** Тиха персистентна мітка-двері: веде на сторінку ідеї, яку живить ця думка. */
function ContextMark({ contextId }: { contextId: string }) {
  return (
    <div className="mt-1">
      <Link
        to="/contexts/$contextId"
        params={{ contextId }}
        className="inline-flex items-center gap-1 font-sans text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
      >
        <Lightbulb className="size-3" aria-hidden />
        перейти в ідеї
      </Link>
    </div>
  );
}

/**
 * Підпис часу під думкою. Прихований за замовчуванням, проявляється при наведенні
 * на думку; повний час — у title-підказці (видно при наведенні на сам підпис).
 */
function ThoughtTime({ rel, title }: { rel: string; title: string }) {
  return (
    <p
      title={title}
      className="mt-1 font-mono text-[11px] tracking-wide text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 hoverless:opacity-100 motion-reduce:transition-none"
    >
      {rel}
    </p>
  );
}

/** Тихий маркер паузи між думками: тонкі лінії й дрібний моноширинний підпис. */
function PauseMarker({ label }: { label: string }) {
  return (
    <li aria-hidden className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="font-mono text-[9.5px] tracking-[0.2em] text-muted-foreground/60">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </li>
  );
}
