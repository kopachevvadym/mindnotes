import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useCreateThought } from "@/lib/mutations";
import { cn } from "@/lib/utils";
import { CaptureNavMenu } from "./CaptureNavMenu";

interface CaptureBarProps {
  sessionId: string;
  /** Сесія порожня: без назви й без жодної думки. */
  isEmptySession: boolean;
  /** Повідомляє сторінку, що поле у фокусі (для приглушення потоку). */
  onFocusChange?: (focused: boolean) => void;
}

/** Поле росте з кількістю рядків; далі — скрол. */
const MAX_ROWS = 5;

/**
 * Поле захоплення. Enter — сабміт, Shift+Enter — новий рядок, порожнє — no-op.
 * Текст контролюється локальним useState. Після сабміту поле очищається й лишається
 * у фокусі; на помилку текст тихо повертається назад.
 */
export function CaptureBar({ sessionId, isEmptySession, onFocusChange }: CaptureBarProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const createThought = useCreateThought(sessionId);

  // Підганяємо висоту під вміст (до MAX_ROWS рядків), далі — скрол.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 0;
    const maxHeight = lineHeight * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [text]);

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
    <div className="sticky bottom-0 z-10 pb-[max(env(safe-area-inset-bottom),1rem)] pt-6">
      <div className="mx-auto w-full max-w-reading rounded-2xl border border-border bg-paper px-6 pb-4 pt-5 shadow-lg">
        <div className="flex items-start gap-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusChange?.(true)}
            onBlur={() => onFocusChange?.(false)}
            rows={1}
            placeholder="Запиши думку…"
            aria-label="Запиши думку"
            className={cn(
              "flex-1 resize-none overflow-y-auto border-0 bg-transparent p-0 font-serif text-lg leading-relaxed text-foreground",
              "placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none",
            )}
          />
          <CaptureNavMenu sessionId={sessionId} isEmptySession={isEmptySession} />
        </div>

        <p className="mt-3 font-mono text-xs text-muted-foreground">
          Enter — наступна · Shift+Enter — новий рядок
        </p>
      </div>
    </div>
  );
}
