import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { contextsQuery } from "@/lib/queries";
import { pluralThoughts } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ContextsListPage() {
  const { data, isPending, isError, error } = useQuery(contextsQuery());

  return (
    <div className="flex flex-1 flex-col pb-16 pt-4">
      {isPending ? (
        <StatusNote>Завантаження…</StatusNote>
      ) : isError ? (
        <StatusNote>Не вдалося завантажити ідеї: {error.message}</StatusNote>
      ) : data.length === 0 ? (
        <StatusNote>Поки жодної ідеї. Виростіть її з думки в потоці.</StatusNote>
      ) : (
        <ol className="mt-4 divide-y divide-border/60">
          {data.map((context) => (
            <li key={context.id}>
              <Link
                to="/contexts/$contextId"
                params={{ contextId: context.id }}
                className="block rounded-lg px-1 py-5 transition-colors hover:bg-accent/40"
              >
                <span
                  className={cn(
                    "font-serif text-xl leading-snug",
                    context.thesis ? "text-foreground" : "italic text-muted-foreground",
                  )}
                >
                  {context.thesis ?? "Без назви"}
                </span>
                <span className="mt-1 block font-sans text-sm text-muted-foreground">
                  {pluralThoughts(context.thoughtCount)}
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
