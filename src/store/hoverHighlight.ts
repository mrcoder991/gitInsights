import { create } from 'zustand';

// Transient UI state: which date range is currently "active" via hover/focus.
// Some sources provide an exact date list when the visual range should skip
// dates inside the span, e.g. Weekly Coding Days excluding off-days.

export type HoverRange = { from: string; to: string; dates?: readonly string[] };

type HoverHighlightState = {
  range: HoverRange | null;
  setRange: (r: HoverRange) => void;
  clear: () => void;
};

export const useHoverHighlight = create<HoverHighlightState>((set) => ({
  range: null,
  setRange: (r) => set({ range: r }),
  clear: () => set({ range: null }),
}));
