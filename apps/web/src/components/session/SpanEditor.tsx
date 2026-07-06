import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { ReadingSpanDto } from "@mindnotes/schema";
import { useDeleteSpan, useUpdateSpan } from "@/lib/mutations";

interface SpanEditorProps {
  /** Інтервал на редагуванні; null = редактор закритий. Лише закриті спани. */
  span: ReadingSpanDto | null;
  onClose: () => void;
}

/** Date → значення для input[type=datetime-local] у ЛОКАЛЬНОМУ часі. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Рядок datetime-local → Date (локальний час) або null. */
function fromLocalInput(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Компактний редактор інтервалу: початок, кінець, тривалість — три зв'язані поля
 * (тривалість — похідна: її зміна перераховує кінець від початку). Там само — видалення.
 */
export function SpanEditor({ span, onClose }: SpanEditorProps) {
  const updateSpan = useUpdateSpan();
  const deleteSpan = useDeleteSpan();
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");

  // Заповнити поля при відкритті (span.id змінюється лише разом зі спаном).
  useEffect(() => {
    if (!span) return;
    setStartStr(toLocalInput(new Date(span.startedAt)));
    setEndStr(span.endedAt ? toLocalInput(new Date(span.endedAt)) : "");
  }, [span?.id]);

  const start = fromLocalInput(startStr);
  const end = fromLocalInput(endStr);
  const durationMin = start && end ? Math.round((end.getTime() - start.getTime()) / 60_000) : 0;
  const valid = !!start && !!end && end.getTime() > start.getTime();

  // datetime-local має хвилинну точність — надсилаємо ЛИШЕ змінені поля, щоб не
  // зрізати секунди незайманих міток (no-op «Зберегти» не сміє зсувати межі).
  const origStartStr = span ? toLocalInput(new Date(span.startedAt)) : "";
  const origEndStr = span?.endedAt ? toLocalInput(new Date(span.endedAt)) : "";

  function setDuration(value: string) {
    const n = Number(value);
    if (!start || !Number.isFinite(n) || n < 1) return;
    setEndStr(toLocalInput(new Date(start.getTime() + Math.round(n) * 60_000)));
  }

  function save() {
    if (!span || !valid) return;
    const input: { startedAt?: string; endedAt?: string } = {};
    if (startStr !== origStartStr) input.startedAt = start!.toISOString();
    if (endStr !== origEndStr) input.endedAt = end!.toISOString();
    if (input.startedAt || input.endedAt) {
      updateSpan.mutate({ id: span.id, ...input });
    }
    onClose();
  }

  function remove() {
    if (!span) return;
    deleteSpan.mutate(span.id);
    onClose();
  }

  const fieldClass =
    "w-full border-0 border-b border-border bg-transparent pb-1 font-sans text-sm text-foreground focus:outline-none";

  return (
    <Dialog.Root open={span !== null} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/20 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-reading rounded-t-2xl border border-border bg-paper p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
        >
          <Dialog.Title className="px-1 pb-3 font-sans text-xs uppercase tracking-wide text-muted-foreground">
            Інтервал читання
          </Dialog.Title>

          <div className="space-y-4 px-1">
            <label className="block">
              <span className="mb-1 block font-sans text-xs text-muted-foreground">Початок</span>
              <input
                type="datetime-local"
                value={startStr}
                onChange={(event) => setStartStr(event.target.value)}
                aria-label="Початок читання"
                className={fieldClass}
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-sans text-xs text-muted-foreground">Кінець</span>
              <input
                type="datetime-local"
                value={endStr}
                onChange={(event) => setEndStr(event.target.value)}
                aria-label="Кінець читання"
                className={fieldClass}
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-sans text-xs text-muted-foreground">
                Тривалість (хв)
              </span>
              <input
                type="number"
                min={1}
                value={durationMin > 0 ? durationMin : ""}
                onChange={(event) => setDuration(event.target.value)}
                aria-label="Тривалість читання у хвилинах"
                className={fieldClass}
              />
            </label>

            {!valid ? (
              <p className="font-sans text-xs text-red-700">
                Кінець має бути пізніше за початок.
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              onClick={remove}
              className="rounded-md px-3 py-2 font-sans text-sm text-red-700 transition-colors hover:bg-red-700/10"
            >
              Видалити інтервал
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 font-sans text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!valid || updateSpan.isPending}
                className="rounded-md px-4 py-2 font-sans text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40"
              >
                Зберегти
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
