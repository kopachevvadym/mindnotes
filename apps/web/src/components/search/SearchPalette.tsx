import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { searchQuery } from "@/lib/queries";
import { useSearchStore } from "@/store/search-store";
import { formatSessionDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Плаский елемент результатів — для наскрізної клавіатурної навігації по групах. */
interface PaletteItem {
  key: string;
  /** Основний рядок (назва/теза/текст думки). */
  label: string;
  /** Курсивом, коли назви/тези нема і показуємо замінник чи превʼю. */
  labelMuted: boolean;
  /** Другий рядок — джерело/дата. */
  sub: string | null;
  go: () => void;
}

interface PaletteGroup {
  title: string;
  items: PaletteItem[];
}

const DEBOUNCE_MS = 200;

/**
 * Палітра пошуку (⌘K): «знайти й перейти» по сесіях, ідеях і думках.
 * Відкривається глобальним хоткеєм (⌘K/Ctrl+K, layout-незалежно через e.code)
 * або кнопкою в шапці сесії. ↑↓ — навігація, Enter — відкрити, Esc — закрити.
 */
export function SearchPalette() {
  const { open, setOpen } = useSearchStore();
  const navigate = useNavigate();

  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Глобальний хоткей. e.code — щоб працювало і в українській розкладці.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.code === "KeyK") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  // Дебаунс запиту, щоб не смикати бекенд на кожну літеру.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const q = debounced.trim();
  const { data, isFetching } = useQuery({
    ...searchQuery(q),
    enabled: open && q.length > 0,
    placeholderData: keepPreviousData,
  });

  const groups: PaletteGroup[] = useMemo(() => {
    if (!data) return [];
    const result: PaletteGroup[] = [];

    if (data.sessions.length > 0) {
      result.push({
        title: "Сесії",
        items: data.sessions.map((s) => ({
          key: `session-${s.id}`,
          label: s.title ?? "Нова сесія",
          labelMuted: s.title === null,
          sub: formatSessionDate(s.createdAt),
          go: () => navigate({ to: "/sessions/$sessionId", params: { sessionId: s.id } }),
        })),
      });
    }

    if (data.contexts.length > 0) {
      result.push({
        title: "Ідеї",
        items: data.contexts.map((g) => ({
          key: `context-${g.id}`,
          label: g.thesis ?? g.previewBody ?? "Без назви",
          labelMuted: g.thesis === null,
          sub: null,
          go: () => navigate({ to: "/contexts/$contextId", params: { contextId: g.id } }),
        })),
      });
    }

    if (data.thoughts.length > 0) {
      result.push({
        title: "Думки",
        items: data.thoughts.map((t) => ({
          key: `thought-${t.id}`,
          label: t.body,
          labelMuted: false,
          sub: `з сесії „${t.sessionTitle ?? "Нова сесія"}“`,
          go: () => navigate({ to: "/sessions/$sessionId", params: { sessionId: t.sessionId } }),
        })),
      });
    }

    return result;
  }, [data, navigate]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Нові результати → активним стає перший.
  useEffect(() => {
    setActiveIndex(0);
  }, [data]);

  function close() {
    setOpen(false);
    setInput("");
    setDebounced("");
    setActiveIndex(0);
  }

  function select(item: PaletteItem | undefined) {
    if (!item) return;
    void item.go();
    close();
  }

  function moveActive(delta: number) {
    if (flat.length === 0) return;
    const next = (activeIndex + delta + flat.length) % flat.length;
    setActiveIndex(next);
    listRef.current
      ?.querySelector(`[data-palette-index="${next}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      select(flat[activeIndex]);
    }
  }

  // Плаский індекс поточного елемента, наростає крізь групи.
  let flatIndex = -1;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/20 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 top-[12dvh] z-50 mx-auto flex max-h-[70dvh] w-full max-w-reading flex-col rounded-2xl border border-border bg-paper p-4 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
        >
          <Dialog.Title className="px-1 pb-2 font-sans text-xs uppercase tracking-wide text-muted-foreground">
            Пошук
          </Dialog.Title>

          <input
            autoFocus
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Сесії, ідеї, думки…"
            aria-label="Пошук"
            className="w-full border-0 border-b border-border bg-transparent px-1 pb-2 font-serif text-lg text-foreground placeholder:text-muted-foreground focus:outline-none"
          />

          <div ref={listRef} className="-mx-1 mt-2 flex-1 overflow-y-auto">
            {q.length === 0 ? (
              <PaletteNote>Почни писати — шукаю по сесіях, ідеях і думках.</PaletteNote>
            ) : !data && isFetching ? (
              <PaletteNote>Шукаю…</PaletteNote>
            ) : flat.length === 0 ? (
              <PaletteNote>Нічого не знайдено.</PaletteNote>
            ) : (
              groups.map((group) => (
                <section key={group.title} className="mb-2">
                  <h3 className="px-2 pb-1 pt-2 font-sans text-xs uppercase tracking-wide text-muted-foreground/70">
                    {group.title}
                  </h3>
                  <ul>
                    {group.items.map((item) => {
                      flatIndex += 1;
                      const index = flatIndex;
                      return (
                        <li key={item.key}>
                          <button
                            type="button"
                            data-palette-index={index}
                            onClick={() => select(item)}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={cn(
                              "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left transition-colors",
                              index === activeIndex ? "bg-accent/60" : "hover:bg-accent/40",
                            )}
                          >
                            <span
                              className={cn(
                                "line-clamp-2 font-serif text-base leading-snug",
                                item.labelMuted ? "italic text-muted-foreground" : "text-foreground",
                              )}
                            >
                              {item.label}
                            </span>
                            {item.sub ? (
                              <span className="font-sans text-xs text-muted-foreground">
                                {item.sub}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>

          <p className="mt-2 border-t border-border/60 px-1 pt-2 font-mono text-xs text-muted-foreground/70">
            ↑↓ — вибір · Enter — відкрити · Esc — закрити
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PaletteNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 py-6 text-center font-sans text-sm text-muted-foreground">{children}</p>
  );
}
