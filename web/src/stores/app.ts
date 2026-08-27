import { create } from 'zustand';
import { api, type User } from '../lib/api';

interface AppState {
  user: User | null;
  authed: boolean | null; // null = 检查中
  setUser: (u: User | null) => void;
  setAuthed: (v: boolean) => void;
  setCredits: (credits: number) => void;
  checkAuth: () => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  user: null,
  authed: null,
  setUser: (user) => set({ user, authed: !!user }),
  setAuthed: (authed) => set((state) => ({ authed, user: authed ? state.user : null })),
  setCredits: (credits) =>
    set((state) => (state.user ? { user: { ...state.user, credits } } : state)),
  checkAuth: async () => {
    try {
      const res = await api.getMe();
      if (res.user) {
        set({ user: res.user, authed: true });
      } else {
        set({ user: null, authed: false });
      }
    } catch {
      set({ user: null, authed: false });
    }
  },
}));
