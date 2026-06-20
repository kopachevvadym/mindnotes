import { useState, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateThought } from "@/lib/mutations";
import { cn } from "@/lib/utils";

interface CaptureBarProps {
  sessionId: string;
  /** Повідомляє сторінку, що поле у фокусі (для приглушення потоку). */
  onFocusChange?: (focused: boolean) => void;
}

/**
 * Поле захоплення. Enter — сабміт, Shift+Enter — новий рядок, порожнє — no-op.
 * Текст контролюється локальним useState. Після сабміту поле очищається й лишається
 * у фокусі; на помилку текст тихо повертається назад.
 */
export function CaptureBar({ sessionId, onFocusChange }: CaptureBarProps) {
  const [text, setText] = useState("");
  const createThought = useCreateThought(sessionId);

  function submit() {
    const body = text.trim();
    if (!body) return; // порожнє — no-op
    setText(""); // очищаємо одразу, фокус лишається
    createThought.mutate(body, {
      onError: () => setText(body), // тихо повертаємо текст, щоб думка не загубилась
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="sticky bottom-0 z-10 bg-linear-to-t from-background via-background to-transparent pb-[max(env(safe-area-inset-bottom),1rem)] pt-6">
      <div className="mx-auto flex w-full max-w-reading items-end gap-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          rows={1}
          placeholder="Запиши думку…"
          aria-label="Запиши думку"
          className={cn(
            "flex max-h-40 min-h-11 w-full resize-none rounded-md border border-input bg-paper px-3 py-2.5 font-serif text-base text-foreground shadow-xs transition-colors",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          )}
        />
        <Button size="icon" aria-label="Додати думку" onClick={submit} className="shrink-0">
          <ArrowUp />
        </Button>
      </div>
    </div>
  );
}
