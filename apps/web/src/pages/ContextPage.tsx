import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { MoreVertical, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { contextQuery } from "@/lib/queries";
import { useDeleteContext, useRemoveThoughtFromContext, useUpdateContext } from "@/lib/mutations";
import { pluralThoughts } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ContextPageProps {
  contextId: string;
}

export function ContextPage({ contextId }: ContextPageProps) {
  const { data, isPending, isError, error } = useQuery(contextQuery(contextId));
  const removeThought = useRemoveThoughtFromContext(contextId);

  if (isPending) {
    return <StatusNote>Завантаження…</StatusNote>;
  }

  if (isError) {
    return <StatusNote>Не вдалося завантажити ідею: {error.message}</StatusNote>;
  }

  const { context, thoughts } = data;

  return (
    <div className="flex flex-1 flex-col pb-16">
      <header className="space-y-4 pt-8 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Теза-лід: порожня → плейсхолдер; клік → інлайн-редагування. «Назад» — лінк «Ідеї» в навігації каркаса. */}
            <ThesisLede contextId={contextId} thesis={context.thesis} />
          </div>
          <ContextMenu contextId={contextId} />
        </div>

        <p className="font-sans text-sm text-muted-foreground">{pluralThoughts(thoughts.length)}</p>
      </header>

      {thoughts.length === 0 ? (
        <StatusNote>У цій ідеї ще немає думок.</StatusNote>
      ) : (
        <ol className="mt-4 space-y-7">
          {thoughts.map((thought) => (
            <li key={thought.id} className="group flex items-start justify-between gap-3">
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
                  className="mt-1 inline-block font-sans text-sm text-muted-foreground/70 underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  з сесії „{thought.sessionTitle ?? "Нова сесія"}“
                </Link>
              </div>

              {/* Тиха дія «відчепити» — думка лишається в потоці. */}
              <button
                type="button"
                onClick={() => removeThought.mutate({ thoughtId: thought.id })}
                aria-label="Відчепити від ідеї"
                title="Відчепити від ідеї"
                className="mt-0.5 shrink-0 rounded-md p-1 text-transparent transition-colors hover:bg-accent hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:text-muted-foreground/40 hoverless:text-muted-foreground/40"
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

/** Меню ідеї: видалення з простим підтвердженням. Думки при цьому лишаються в потоці. */
function ContextMenu({ contextId }: { contextId: string }) {
  const [confirm, setConfirm] = useState(false);
  const deleteContext = useDeleteContext();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Дії з ідеєю"
          className="mt-1 shrink-0 rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent data-[state=open]:text-foreground"
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => setConfirm(true)}
            className="text-red-700 focus:text-red-700"
          >
            Видалити ідею
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog.Root open={confirm} onOpenChange={setConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/20 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-reading rounded-t-2xl border border-border bg-paper p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom">
            <Dialog.Title className="font-serif text-xl text-foreground">Видалити ідею?</Dialog.Title>
            <Dialog.Description className="mt-1 font-sans text-sm text-muted-foreground">
              Думки лишаться в потоці — зникне лише ця ідея.
            </Dialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(false)}
                className="rounded-md px-4 py-2 font-sans text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={() => deleteContext.mutate(contextId)}
                disabled={deleteContext.isPending}
                className="rounded-md px-4 py-2 font-sans text-sm font-medium text-red-700 transition-colors hover:bg-red-700/10 disabled:opacity-50"
              >
                Видалити
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

/**
 * Теза ідеї як редагований лід (патерн інлайн-редагування з SessionHeader).
 * Порожня → плейсхолдер «Сформулюй ідею…»; коміт → PATCH (оптимістично). Теза не обовʼязкова.
 */
function ThesisLede({ contextId, thesis }: { contextId: string; thesis: string | null }) {
  const updateContext = useUpdateContext(contextId);
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
      updateContext.mutate({ thesis: next });
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
