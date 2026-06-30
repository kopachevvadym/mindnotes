import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { sessionsQuery } from "@/lib/queries";
import { useCreateSession } from "@/lib/mutations";
import { formatSessionDate, pluralThoughts } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SessionsListPage() {
  const { data, isPending, isError, error } = useQuery(sessionsQuery());
  const createSession = useCreateSession();

  return (
    <div className="flex flex-1 flex-col pb-16">
      <header className="flex items-center justify-end pb-2 pt-4">
        <button
          type="button"
          onClick={() => createSession.mutate()}
          disabled={createSession.isPending}
          className="inline-flex items-center gap-1.5 font-sans text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
        >
          <Plus className="size-4" />
          нова сесія
        </button>
      </header>

      {isPending ? (
        <StatusNote>Завантаження…</StatusNote>
      ) : isError ? (
        <StatusNote>Не вдалося завантажити сесії: {error.message}</StatusNote>
      ) : data.length === 0 ? (
        <StatusNote>Поки жодної сесії. Почни нову — і пиши.</StatusNote>
      ) : (
        <ol className="mt-4 divide-y divide-border/60">
          {data.map((session) => (
            <li key={session.id}>
              <Link
                to="/sessions/$sessionId"
                params={{ sessionId: session.id }}
                className="block rounded-lg px-1 py-5 transition-colors hover:bg-accent/40"
              >
                <span
                  className={cn(
                    "font-serif text-xl leading-snug",
                    session.title ? "text-foreground" : "italic text-muted-foreground",
                  )}
                >
                  {session.title ?? "Нова сесія"}
                </span>
                <span className="mt-1 block font-sans text-sm text-muted-foreground">
                  {formatSessionDate(session.createdAt)} · {pluralThoughts(session.thoughtCount)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function StatusNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-24 text-center font-serif text-lg italic text-muted-foreground">{children}</p>
  );
}
