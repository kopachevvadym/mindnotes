import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { ContextDto } from "@mindnotes/schema";
import { cn } from "@/lib/utils";

interface ContextChipsProps {
  contexts: ContextDto[];
  focusedId: string | null;
  onFocus: (id: string) => void;
}

/**
 * Список наявних контекстів у Синтезі. Тап ФОКУСУЄ контекст (повторний тап — знімає
 * фокус); члени сфокусованого контексту підсвічуються в потоці.
 */
export function ContextChips({ contexts, focusedId, onFocus }: ContextChipsProps) {
  if (contexts.length === 0) {
    return (
      <p className="pt-3 font-sans text-sm text-muted-foreground">
        Контекстів ще немає. Вибери думки й додай у новий контекст нижче.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 pt-3">
      {contexts.map((context) => {
        const isFocused = focusedId === context.id;
        return (
          <div
            key={context.id}
            className={cn(
              "inline-flex items-center rounded-full border font-sans text-sm transition-colors",
              isFocused ? "border-primary bg-primary/10" : "border-border",
            )}
          >
            <button
              type="button"
              onClick={() => onFocus(context.id)}
              aria-pressed={isFocused}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-l-full py-1 pr-1.5 pl-3 transition-colors",
                isFocused ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span aria-hidden>{context.emoji}</span>
              {context.name}
            </button>
            <Link
              to="/contexts/$contextId"
              params={{ contextId: context.id }}
              aria-label={`Відкрити контекст ${context.name}`}
              className="rounded-r-full py-1 pr-2.5 pl-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
