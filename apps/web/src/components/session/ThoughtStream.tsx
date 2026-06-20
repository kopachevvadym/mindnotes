import type { ThoughtDto } from "@mindnotes/schema";
import { cn } from "@/lib/utils";

interface ThoughtStreamProps {
  thoughts: ThoughtDto[];
}

export function ThoughtStream({ thoughts }: ThoughtStreamProps) {
  if (thoughts.length === 0) {
    return (
      <p className="py-16 text-center font-serif text-lg italic text-muted-foreground">
        Тут поки порожньо. Перша думка — нижче.
      </p>
    );
  }

  return (
    <ol className="space-y-7">
      {thoughts.map((thought) => (
        <li key={thought.id}>
          <p
            className={cn(
              "font-serif text-lg leading-relaxed",
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
