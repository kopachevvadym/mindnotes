import { useLayoutEffect, useRef } from "react";
import { MoreVertical } from "lucide-react";
import type { ThoughtDto } from "@mindnotes/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSetThoughtArchived } from "@/lib/mutations";
import { cn } from "@/lib/utils";

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

  return (
    <ol
      className={cn(
        "space-y-7 transition-opacity duration-[180ms] ease-out motion-reduce:transition-none",
        dimmed ? "opacity-[0.7]" : "opacity-100",
      )}
    >
      {thoughts.map((thought) => (
        <li key={thought.id} className="flex items-start justify-between gap-3">
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
      ))}
    </ol>
  );
}
