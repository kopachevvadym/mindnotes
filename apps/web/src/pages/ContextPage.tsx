import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, X } from "lucide-react";
import { contextQuery } from "@/lib/queries";
import { useRemoveThoughtFromContextPage } from "@/lib/mutations";
import { pluralThoughts } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ContextPageProps {
  contextId: string;
}

export function ContextPage({ contextId }: ContextPageProps) {
  const { data, isPending, isError, error } = useQuery(contextQuery(contextId));
  const removeThought = useRemoveThoughtFromContextPage(contextId);

  if (isPending) {
    return <StatusNote>Завантаження…</StatusNote>;
  }

  if (isError) {
    return <StatusNote>Не вдалося завантажити контекст: {error.message}</StatusNote>;
  }

  const { context, thoughts } = data;

  return (
    <div className="flex flex-1 flex-col pb-16">
      <header className="space-y-2 pt-8 pb-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1 font-sans text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          сесії
        </Link>
        <h1 className="flex items-center gap-3 font-serif text-3xl font-semibold tracking-tight text-foreground">
          <span aria-hidden className="text-4xl leading-none">
            {context.emoji}
          </span>
          {context.name}
        </h1>
        <p className="font-sans text-sm text-muted-foreground">{pluralThoughts(thoughts.length)}</p>
      </header>

      {thoughts.length === 0 ? (
        <StatusNote>У цьому контексті ще немає думок.</StatusNote>
      ) : (
        <ol className="mt-4 space-y-7">
          {thoughts.map((thought) => (
            <li key={thought.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
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
                  className="mt-1 inline-block font-sans text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  з сесії „{thought.sessionTitle ?? "Нова сесія"}“
                </Link>
              </div>

              <button
                type="button"
                onClick={() => removeThought.mutate({ thoughtId: thought.id })}
                aria-label="Прибрати з контексту"
                className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
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
