import { create } from "zustand";

/** Відкритість палітри пошуку (⌘K) — спільна для шапки й глобального хоткея. */
interface SearchState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
