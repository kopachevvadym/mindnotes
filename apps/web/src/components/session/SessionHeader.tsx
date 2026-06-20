import { Search } from "lucide-react";
import type { SessionDto } from "@mindnotes/schema";
import { Button } from "@/components/ui/button";
import { formatSessionDate, pluralThoughts } from "@/lib/format";

interface SessionHeaderProps {
  session: SessionDto;
  activeCount: number;
  archivedCount: number;
}

export function SessionHeader({ session, activeCount, archivedCount }: SessionHeaderProps) {
  return (
    <header className="space-y-3 pt-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-foreground">
          {session.title ?? "Нова сесія"}
        </h1>
        {/* ⌘K — поки лише візуально (крок наступний) */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Пошук (⌘K)"
          className="-mr-2 shrink-0 text-muted-foreground"
        >
          <Search />
        </Button>
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
