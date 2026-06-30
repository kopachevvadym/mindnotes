import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Lightbulb, MoreVertical } from "lucide-react";
import { THOUGHT_EDIT_WINDOW_MIN, type SessionThoughtDto } from "@mindnotes/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCreateIdea,
  useDeleteThought,
  useEditThought,
  useSetThoughtArchived,
} from "@/lib/mutations";
import {
  formatClockTime,
  formatFullDateTime,
  minutesAgo,
  relativeThoughtTime,
} from "@/lib/format";
import { cn } from "@/lib/utils";

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

interface ThoughtStreamProps {
  thoughts: SessionThoughtDto[];
  sessionId: string;
  /** Приглушити потік, поки користувач пише (фокус уперед). */
  dimmed?: boolean;
}

export function ThoughtStream({ thoughts, sessionId, dimmed = false }: ThoughtStreamProps) {
  const setArchived = useSetThoughtArchived(sessionId);
  const createIdea = useCreateIdea(sessionId);
  const editThought = useEditThought(sessionId);
  const deleteThought = useDeleteThought(sessionId);

  // Інлайн-редагування: id думки, що редагується, + чернетка тексту.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const editRef = useRef<HTMLTextAreaElement>(null);
  const skipBlur = useRef(false);

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

  if (thoughts.length === 0) {
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

  return (
    <ol
      className={cn(
        "space-y-4 transition-opacity duration-[180ms] ease-out motion-reduce:transition-none",
        dimmed ? "opacity-[0.7]" : "opacity-100",
      )}
    >
      {rows.map(({ thought, showPause, pauseLabel, rel, fullTime }) => {
        const isEditing = editingId === thought.id;
        // У межах вікна (від створення) думку ще можна редагувати/видалити.
        const editable = minutesAgo(thought.createdAt) < THOUGHT_EDIT_WINDOW_MIN;

        return (
          <Fragment key={thought.id}>
            {showPause ? <PauseMarker label={pauseLabel} /> : null}
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
                    {thought.ideaCount > 0 ? <IdeaMark count={thought.ideaCount} /> : null}
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
                    <DropdownMenuItem onSelect={() => createIdea.mutate({ seedThoughtId: thought.id })}>
                      → в ідею
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
      })}
    </ol>
  );
}

/** Тиха персистентна мітка: думка живить ідею(ї). */
function IdeaMark({ count }: { count: number }) {
  return (
    <p className="mt-1 flex items-center gap-1 font-sans text-[11px] text-muted-foreground">
      <Lightbulb className="size-3" aria-hidden />
      {count === 1 ? "в ідеї" : `у ${count} ідеях`}
    </p>
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
      className="mt-1 font-mono text-[11px] tracking-wide text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 motion-reduce:transition-none"
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
