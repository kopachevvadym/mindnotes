import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ideaQuery } from "@/lib/queries";
import { useUpdateIdea } from "@/lib/mutations";
import { pluralThoughts } from "@/lib/format";
import { cn } from "@/lib/utils";

interface IdeaPageProps {
  ideaId: string;
}

export function IdeaPage({ ideaId }: IdeaPageProps) {
  const { data, isPending, isError, error } = useQuery(ideaQuery(ideaId));

  if (isPending) {
    return <StatusNote>Завантаження…</StatusNote>;
  }

  if (isError) {
    return <StatusNote>Не вдалося завантажити ідею: {error.message}</StatusNote>;
  }

  const { idea, thoughts } = data;

  return (
    <div className="flex flex-1 flex-col pb-16">
      <header className="space-y-4 pt-8 pb-2">
        {/* Теза-лід: порожня → плейсхолдер; клік → інлайн-редагування. «Назад» — у каркасі. */}
        <ThesisLede ideaId={ideaId} thesis={idea.thesis} />

        <p className="font-sans text-sm text-muted-foreground">{pluralThoughts(thoughts.length)}</p>
      </header>

      {thoughts.length === 0 ? (
        <StatusNote>У цій ідеї ще немає думок.</StatusNote>
      ) : (
        <ol className="mt-4 space-y-7">
          {thoughts.map((thought) => (
            <li key={thought.id} className="min-w-0">
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
              <Link
                to="/sessions/$sessionId"
                params={{ sessionId: thought.sessionId }}
                className="mt-1 inline-block font-sans text-sm text-muted-foreground/70 underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                з сесії „{thought.sessionTitle ?? "Нова сесія"}“
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Теза ідеї як редагований лід (патерн інлайн-редагування з SessionHeader).
 * Порожня → плейсхолдер «Сформулюй ідею…»; коміт → PATCH (оптимістично). Теза не обовʼязкова.
 */
function ThesisLede({ ideaId, thesis }: { ideaId: string; thesis: string | null }) {
  const updateIdea = useUpdateIdea(ideaId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [editing]);

  function startEditing() {
    setDraft(thesis ?? "");
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const next = draft.trim() === "" ? null : draft.trim();
    if (next !== thesis) {
      updateIdea.mutate({ thesis: next });
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        rows={2}
        placeholder="Сформулюй ідею…"
        aria-label="Теза ідеї"
        className="w-full resize-none border-0 border-b border-border bg-transparent pb-1 font-serif text-3xl font-semibold leading-tight tracking-tight text-foreground placeholder:not-italic placeholder:text-muted-foreground/50 focus:outline-none"
      />
    );
  }

  if (thesis) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className="block w-full text-left font-serif text-3xl font-semibold leading-tight tracking-tight text-foreground transition-opacity hover:opacity-70"
      >
        {thesis}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className="font-serif text-3xl font-semibold italic leading-tight tracking-tight text-muted-foreground/50 transition-colors hover:text-muted-foreground"
    >
      Сформулюй ідею…
    </button>
  );
}

function StatusNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-24 text-center font-serif text-lg italic text-muted-foreground">{children}</p>
  );
}
