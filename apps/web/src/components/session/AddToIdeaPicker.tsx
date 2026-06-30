import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { ideasQuery } from "@/lib/queries";
import { useAddThoughtToIdea } from "@/lib/mutations";
import { formatSessionDate, pluralThoughts } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AddToIdeaPickerProps {
  sessionId: string;
  /** Думка, яку втягуємо в ідею; null = пікер закритий. */
  thoughtId: string | null;
  onClose: () => void;
}

/**
 * Пікер «у наявну ідею»: пошук за тезою + список. Нуль-теза показується як «Без назви»
 * з датою (щоб тестові дублі були відрізнянні). Вибір → втягнути думку. Bottom-sheet, ~380px.
 */
export function AddToIdeaPicker({ sessionId, thoughtId, onClose }: AddToIdeaPickerProps) {
  const open = thoughtId !== null;
  const [query, setQuery] = useState("");
  const { data: ideas = [], isPending } = useQuery({ ...ideasQuery(), enabled: open });
  const addThought = useAddThoughtToIdea(sessionId);

  const trimmed = query.trim().toLowerCase();
  const matches = trimmed
    ? ideas.filter((i) => (i.thesis ?? "").toLowerCase().includes(trimmed))
    : ideas;

  function pick(ideaId: string) {
    if (!thoughtId) return;
    addThought.mutate({ ideaId, thoughtId });
    onClose();
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/20 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[80dvh] w-full max-w-reading flex-col rounded-t-2xl border border-border bg-paper p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
        >
          <Dialog.Title className="px-1 pb-2 font-sans text-xs uppercase tracking-wide text-muted-foreground">
            У яку ідею?
          </Dialog.Title>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Пошук ідеї за тезою…"
            aria-label="Пошук ідеї"
            className="w-full border-0 border-b border-border bg-transparent px-1 pb-2 font-serif text-lg text-foreground placeholder:text-muted-foreground focus:outline-none"
          />

          {isPending ? (
            <p className="px-1 py-6 text-center font-sans text-sm text-muted-foreground">
              Завантаження…
            </p>
          ) : matches.length === 0 ? (
            <p className="px-1 py-6 text-center font-sans text-sm text-muted-foreground">
              {ideas.length === 0 ? "Ще немає ідей — створи нову." : "Нічого не знайдено."}
            </p>
          ) : (
            <ul className="-mx-1 mt-2 overflow-y-auto">
              {matches.map((idea) => (
                <li key={idea.id}>
                  <button
                    type="button"
                    onClick={() => pick(idea.id)}
                    className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent/50"
                  >
                    <span
                      className={cn(
                        "font-serif text-base leading-snug",
                        idea.thesis ? "text-foreground" : "italic text-muted-foreground",
                      )}
                    >
                      {idea.thesis ?? "Без назви"}
                    </span>
                    <span className="font-sans text-xs text-muted-foreground">
                      {formatSessionDate(idea.createdAt)} · {pluralThoughts(idea.thoughtCount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
