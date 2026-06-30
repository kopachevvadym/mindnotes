import { Fragment, useLayoutEffect, useRef } from "react";
import { MoreVertical } from "lucide-react";
import type { ThoughtDto } from "@mindnotes/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSetThoughtArchived } from "@/lib/mutations";
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
  thought: ThoughtDto;
  showPause: boolean;
  pauseLabel: string;
  /** Людський відносний підпис часу. */
  rel: string;
  /** Повний час для title-підказки. */
  fullTime: string;
}

interface ThoughtStreamProps {
  thoughts: ThoughtDto[];
  sessionId: string;
  /** Приглушити потік, поки користувач пише (фокус уперед). */
  dimmed?: boolean;
}

export function ThoughtStream({ thoughts, sessionId, dimmed = false }: ThoughtStreamProps) {
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
      {rows.map(({ thought, showPause, pauseLabel, rel, fullTime }) => (
        <Fragment key={thought.id}>
          {showPause ? <PauseMarker label={pauseLabel} /> : null}
          <li className="group flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
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
              <ThoughtTime rel={rel} title={fullTime} />
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
