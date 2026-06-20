import { useState } from "react";
import { Plus } from "lucide-react";
import type { ContextDto } from "@mindnotes/schema";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { pluralThoughts } from "@/lib/format";

interface SynthesisAssignBarProps {
  contexts: ContextDto[];
  selectedCount: number;
  busy: boolean;
  onAssignExisting: (contextId: string) => void;
  onAssignNew: (name: string, emoji: string) => void;
}

/**
 * Пікер для призначення вибраних думок у контекст. Однорядковий пошук за назвою;
 * зліва — емодзі (тап змінює), справа — створити новий; над полем — список збігів.
 */
export function SynthesisAssignBar({
  contexts,
  selectedCount,
  busy,
  onAssignExisting,
  onAssignNew,
}: SynthesisAssignBarProps) {
  const [query, setQuery] = useState("");
  const [emoji, setEmoji] = useState("💡");

  const trimmed = query.trim();
  const matches = trimmed
    ? contexts.filter((c) => c.name.toLowerCase().includes(trimmed.toLowerCase()))
    : contexts;
  const canCreate = trimmed.length > 0;

  function createNew() {
    if (!canCreate || busy) return;
    onAssignNew(trimmed, emoji);
    setQuery("");
  }

  return (
    <div className="sticky bottom-0 z-10 pt-6 pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="mx-auto w-full max-w-reading rounded-2xl border border-border bg-paper px-4 pt-3 pb-4 shadow-lg">
        <p className="px-1 pb-2 font-sans text-xs uppercase tracking-wide text-muted-foreground">
          {pluralThoughts(selectedCount)} вибрано → у контекст
        </p>

        {matches.length > 0 ? (
          <ul className="mb-2 max-h-40 overflow-y-auto">
            {matches.map((context) => (
              <li key={context.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAssignExisting(context.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left font-serif text-base text-foreground transition-colors hover:bg-accent/50 disabled:opacity-50"
                >
                  <span aria-hidden>{context.emoji}</span>
                  {context.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-center gap-2">
          <EmojiPicker value={emoji} onChange={setEmoji} />

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                createNew();
              }
            }}
            placeholder="у контекст…"
            aria-label="Пошук або назва контексту"
            className="flex-1 border-0 bg-transparent font-serif text-lg text-foreground placeholder:text-muted-foreground focus:outline-none"
          />

          <button
            type="button"
            onClick={createNew}
            disabled={!canCreate || busy}
            aria-label="Створити контекст"
            title="Створити новий контекст"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <Plus className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
