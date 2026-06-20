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
          <button
            key={context.id}
            type="button"
            onClick={() => onFocus(context.id)}
            aria-pressed={isFocused}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-sans text-sm transition-colors",
              isFocused
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <span aria-hidden>{context.emoji}</span>
            {context.name}
          </button>
        );
      })}
    </div>
  );
}
