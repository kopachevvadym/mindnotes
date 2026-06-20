import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { List, MoreHorizontal, Plus } from "lucide-react";
import { useCreateSession, useDeleteSession } from "@/lib/mutations";

interface CaptureNavMenuProps {
  sessionId: string;
  /** Сесія порожня: без назви й без жодної думки. */
  isEmptySession: boolean;
}

/**
 * Меню «Навігація» — виїжджає знизу від кнопки біля поля вводу.
 * «Нова сесія» ховається, якщо ми вже в порожній сесії; у такому разі перехід до
 * списку сесій спершу прибирає цю порожню сесію.
 */
export function CaptureNavMenu({ sessionId, isEmptySession }: CaptureNavMenuProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();

  function newSession() {
    setOpen(false);
    createSession.mutate(); // інвалідація + навігація на нову сесію
  }

  async function viewSessions() {
    setOpen(false);
    if (isEmptySession) {
      await deleteSession.mutateAsync(sessionId); // прибрати покинуту порожню сесію
    }
    void navigate({ to: "/" });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="Навігація"
        className="-mr-1 shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:text-foreground"
      >
        <MoreHorizontal className="size-6" />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/20 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-reading rounded-t-2xl border border-border bg-paper p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
        >
          <Dialog.Title className="px-2 pb-2 font-sans text-xs uppercase tracking-wide text-muted-foreground">
            Навігація
          </Dialog.Title>

          <div className="flex flex-col">
            {!isEmptySession ? (
              <button
                type="button"
                onClick={newSession}
                className="flex items-center gap-3 rounded-md px-2 py-3 text-left font-serif text-lg text-foreground transition-colors hover:bg-accent/50"
              >
                <Plus className="size-5 text-muted-foreground" />
                Нова сесія
              </button>
            ) : null}

            <button
              type="button"
              onClick={viewSessions}
              className="flex items-center gap-3 rounded-md px-2 py-3 text-left font-serif text-lg text-foreground transition-colors hover:bg-accent/50"
            >
              <List className="size-5 text-muted-foreground" />
              Переглянути сесії
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
