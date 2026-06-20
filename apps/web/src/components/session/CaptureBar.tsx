import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Поле захоплення. Рендериться візуально, але НЕ функціональне — мутація прийде
 * в кроці 2 (тоді ввімкнеться через useCaptureStore).
 */
export function CaptureBar() {
  return (
    <div className="sticky bottom-0 z-10 bg-linear-to-t from-background via-background to-transparent pb-[max(env(safe-area-inset-bottom),1rem)] pt-6">
      <div className="mx-auto flex w-full max-w-reading items-center gap-2">
        <Input
          placeholder="Запиши думку…"
          aria-label="Запиши думку"
          disabled
          className="font-serif"
        />
        <Button size="icon" aria-label="Додати думку" disabled className="shrink-0">
          <ArrowUp />
        </Button>
      </div>
    </div>
  );
}
