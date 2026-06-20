import { create } from "zustand";

/**
 * Стан режиму захоплення (Потік). Встановлено в кроці 1, але ще НЕ використовується —
 * мутація захоплення прийде в кроці 2.
 */
interface CaptureState {
  draft: string;
  setDraft: (value: string) => void;
  clearDraft: () => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  draft: "",
  setDraft: (value) => set({ draft: value }),
  clearDraft: () => set({ draft: "" }),
}));
