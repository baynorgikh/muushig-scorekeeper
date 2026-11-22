import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RoundEntry } from '../types';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

interface UiState {
  toasts: Toast[];
  toast: (text: string, kind?: Toast['kind']) => void;
  dismiss: (id: number) => void;
  online: boolean;
  setOnline: (v: boolean) => void;
  pendingSync: number;
  syncError: string | null;
  lastSyncedAt: string | null;
  setSync: (p: { pending: number; error?: string | null; syncedAt?: string | null }) => void;
}

let nextId = 1;

export const useUi = create<UiState>((set, get) => ({
  toasts: [],
  toast: (text, kind = 'success') => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, kind, text }] });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 6000 : 3000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  setOnline: (online) => set({ online }),
  pendingSync: 0,
  syncError: null,
  lastSyncedAt: null,
  setSync: ({ pending, error, syncedAt }) =>
    set((s) => ({ pendingSync: pending, syncError: error ?? null, lastSyncedAt: syncedAt ?? s.lastSyncedAt })),
}));

export interface RoundDraftState {
  id: string;
  entries: RoundEntry[];
  instantWinPlayerId: string | null;
  note: string;
}

interface DraftState {
  /** In-progress round per game, persisted so a refresh never loses typed input. */
  drafts: Record<string, RoundDraftState>;
  setDraft: (gameId: string, d: RoundDraftState) => void;
  clearDraft: (gameId: string) => void;
}

export const useDrafts = create<DraftState>()(
  persist(
    (set) => ({
      drafts: {},
      setDraft: (gameId, d) => set((s) => ({ drafts: { ...s.drafts, [gameId]: d } })),
      clearDraft: (gameId) =>
        set((s) => {
          const next = { ...s.drafts };
          delete next[gameId];
          return { drafts: next };
        }),
    }),
    { name: 'muushig-round-drafts' },
  ),
);
