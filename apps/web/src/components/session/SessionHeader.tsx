import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import type { SessionDto } from "@mindnotes/schema";
import { Button } from "@/components/ui/button";
import { useUpdateSession } from "@/lib/mutations";
import { useSearchStore } from "@/store/search-store";
import { formatSessionDate, pluralThoughts } from "@/lib/format";
import { ReadingTimer } from "./ReadingTimer";

interface SessionHeaderProps {
  session: SessionDto;
  activeCount: number;
  archivedCount: number;
}

export function SessionHeader({ session, activeCount, archivedCount }: SessionHeaderProps) {
  const updateSession = useUpdateSession(session.id);
  const openSearch = useSearchStore((s) => s.setOpen);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEditing() {
    setDraft(session.title ?? "");
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const next = draft.trim() === "" ? null : draft.trim(); // порожня назва дозволена → null
    if (next !== session.title) {
      updateSession.mutate({ title: next });
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditing(false);
    }
  }

  return (
    <header className="sticky top-0 z-10 space-y-3 bg-background/80 pt-8 pb-3 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commit}
            placeholder="Назва сесії"
            aria-label="Назва сесії"
            className="w-full border-0 border-b border-border bg-transparent pb-1 font-serif text-3xl font-semibold leading-tight tracking-tight text-foreground placeholder:not-italic placeholder:text-muted-foreground/60 focus:outline-none"
          />
        ) : session.title ? (
          <button
            type="button"
            onClick={startEditing}
            className="text-left font-serif text-3xl font-semibold leading-tight tracking-tight text-foreground transition-opacity hover:opacity-70"
          >
            {session.title}
          </button>
        ) : (
          <div className="flex flex-col items-start gap-1">
            <h1 className="font-serif text-3xl font-semibold italic leading-tight tracking-tight text-muted-foreground">
              Нова сесія
            </h1>
            <button
              type="button"
              onClick={startEditing}
              className="font-sans text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              + назвати сесію
            </button>
          </div>
        )}

        {!editing ? (
          <div className="-mr-2 flex shrink-0 items-center gap-1">
            {/* Таймер читання — ліворуч від пошуку */}
            <ReadingTimer />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Пошук (⌘K)"
              onClick={() => openSearch(true)}
              className="shrink-0 text-muted-foreground"
            >
              <Search />
            </Button>
          </div>
        ) : null}
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-sm text-muted-foreground">
        <span>{formatSessionDate(session.startedAt)}</span>
        <span aria-hidden>·</span>
        <span>{pluralThoughts(activeCount)}</span>
        {archivedCount > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span>{archivedCount} в архіві</span>
          </>
        ) : null}
      </p>
    </header>
  );
}
