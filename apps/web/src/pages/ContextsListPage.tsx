import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ContextListItem } from "@mindnotes/schema";
import { contextsQuery } from "@/lib/queries";
import { pluralThoughts } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Список груп на градієнті зрілості, двома секціями: «Ідеї» (теза є) і
 * «Контексти» (тези ще нема — показуємо превʼю найранішої думки).
 */
export function ContextsListPage() {
  const { data, isPending, isError, error } = useQuery(contextsQuery());

  if (isPending) {
    return <StatusNote>Завантаження…</StatusNote>;
  }
  if (isError) {
    return <StatusNote>Не вдалося завантажити ідеї: {error.message}</StatusNote>;
  }
  if (data.length === 0) {
    return <StatusNote>Поки жодної ідеї. Виростіть її з думки в потоці.</StatusNote>;
  }

  const ideas = data.filter((c) => c.thesis !== null);
  const contexts = data.filter((c) => c.thesis === null);

  return (
    <div className="flex flex-1 flex-col gap-2 pb-16 pt-4">
      {ideas.length > 0 ? (
        <ContextSection title={contexts.length > 0 ? "Ідеї" : null} items={ideas} />
      ) : null}
      {contexts.length > 0 ? (
        <ContextSection title={ideas.length > 0 ? "Контексти" : null} items={contexts} />
      ) : null}
    </div>
  );
}

/** Секція списку; заголовок опційний — коли секція одна, він зайвий. */
function ContextSection({ title, items }: { title: string | null; items: ContextListItem[] }) {
  return (
    <section className="mt-4">
      {title ? (
        <h2 className="px-1 pb-1 font-sans text-xs uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      ) : null}
      <ol className="divide-y divide-border/60">
        {items.map((context) => (
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
                {context.thesis ?? context.previewBody ?? "Без назви"}
              </span>
              <span className="mt-1 block font-sans text-sm text-muted-foreground">
                {pluralThoughts(context.thoughtCount)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StatusNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-24 text-center font-serif text-lg italic text-muted-foreground">{children}</p>
  );
}
