import { useLayoutEffect, useRef } from "react";
import type { ThoughtDto } from "@mindnotes/schema";
import { cn } from "@/lib/utils";

interface ThoughtStreamProps {
  thoughts: ThoughtDto[];
  /** Приглушити потік, поки користувач пише (фокус уперед). */
  dimmed?: boolean;
}

export function ThoughtStream({ thoughts, dimmed = false }: ThoughtStreamProps) {
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
        <li key={thought.id}>
          <p
            className={cn(
              "whitespace-pre-wrap font-serif text-lg leading-relaxed",
              thought.archived ? "text-muted-foreground/70 italic" : "text-foreground",
            )}
          >
            {thought.body}
          </p>
          {thought.archived ? (
            <span className="mt-1 inline-block font-sans text-xs uppercase tracking-wide text-muted-foreground/60">
              в архіві
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
