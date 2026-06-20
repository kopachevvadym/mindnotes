import { Fragment, useLayoutEffect, useRef } from "react";
import { Check, MoreVertical } from "lucide-react";
import type { ContextDto, SessionThoughtDto } from "@mindnotes/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSetThoughtArchived } from "@/lib/mutations";
import { formatClockTime, minutesAgo, relativeThoughtTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SessionMode } from "./SessionHeader";

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
  /** Точний час (для title-підказки), напр. «14:19». */
  time: string;
  /** Людський відносний підпис часу. */
  rel: string;
}

interface ThoughtStreamProps {
  thoughts: SessionThoughtDto[];
  sessionId: string;
  /** Приглушити потік, поки користувач пише (фокус уперед). */
  dimmed?: boolean;
  mode: SessionMode;
  /** Синтез: вибрані думки (для призначення). */
  selectedIds: Set<string>;
  /** Синтез: сфокусований контекст — його члени підсвічуються. */
  focusedContext: ContextDto | null;
  onThoughtTap: (thought: SessionThoughtDto) => void;
}

export function ThoughtStream({
  thoughts,
  sessionId,
  dimmed = false,
  mode,
  selectedIds,
  focusedContext,
  onThoughtTap,
}: ThoughtStreamProps) {
  const setArchived = useSetThoughtArchived(sessionId);

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

  if (thoughts.length === 0) {
    return (
      <p className="py-16 text-center font-serif text-lg italic text-muted-foreground">
        Тут поки порожньо. Перша думка — нижче.
      </p>
    );
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
      time,
      rel: relativeThoughtTime(agoMin, time),
    };
  });

  const isSynthesis = mode === "synthesis";

  if (isSynthesis) {
    return (
      <ol className="space-y-1">
        {rows.map(({ thought, showPause, pauseLabel, time, rel }) => {
          const isMember = focusedContext ? thought.contextIds.includes(focusedContext.id) : false;
          const isSelected = selectedIds.has(thought.id);

          return (
            <Fragment key={thought.id}>
              {showPause ? <PauseMarker label={pauseLabel} /> : null}
              <li>
                <button
                  type="button"
                  onClick={() => onThoughtTap(thought)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg p-3 text-left transition-all",
                    focusedContext
                      ? isMember
                        ? "bg-primary/10 hover:bg-primary/15"
                        : "opacity-50 hover:opacity-80"
                      : isSelected
                        ? "bg-accent/50 ring-2 ring-primary ring-inset"
                        : "hover:bg-accent/40",
                  )}
                >
                  {focusedContext ? (
                    <span className="mt-0.5 w-5 shrink-0 text-center text-base" aria-hidden>
                      {isMember ? focusedContext.emoji : ""}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {isSelected ? <Check className="size-3.5" /> : null}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "font-serif text-lg leading-relaxed",
                        thought.archived
                          ? "whitespace-normal italic text-muted-foreground/70"
                          : "whitespace-pre-wrap text-foreground",
                      )}
                    >
                      {thought.body}
                    </p>
                    <ThoughtTime rel={rel} time={time} />
                  </div>
                </button>
              </li>
            </Fragment>
          );
        })}
      </ol>
    );
  }

  return (
    <ol
      className={cn(
        "space-y-7 transition-opacity duration-[180ms] ease-out motion-reduce:transition-none",
        dimmed ? "opacity-[0.7]" : "opacity-100",
      )}
    >
      {rows.map(({ thought, showPause, pauseLabel, time, rel }) => (
        <Fragment key={thought.id}>
          {showPause ? <PauseMarker label={pauseLabel} /> : null}
          <li className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "font-serif text-lg leading-relaxed transition-colors",
                  thought.archived
                    ? "whitespace-normal italic text-muted-foreground/70"
                    : "whitespace-pre-wrap text-foreground",
                )}
              >
                {thought.body}
              </p>
              <ThoughtTime rel={rel} time={time} />
            </div>

            {/* Тиха дія — лише в меню «⋮» */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Дії з думкою"
                className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent data-[state=open]:text-foreground"
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() =>
                    setArchived.mutate({ id: thought.id, archived: !thought.archived })
                  }
                >
                  {thought.archived ? "Розархівувати" : "Архівувати"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}

/** Підпис часу під думкою: відносний рядок, точний час — у title-підказці. */
function ThoughtTime({ rel, time }: { rel: string; time: string }) {
  return (
    <p className="mt-1 font-mono text-[11px] tracking-wide text-muted-foreground/60" title={time}>
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
