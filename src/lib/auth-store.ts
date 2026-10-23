"use client";

/**
 * استور احراز هویت حافظ — حساب کاربری، دیالوگ ورود، و قفل پیام برای مهمان‌ها
 */
import { create } from "zustand";

export interface AuthUser {
  id: string;
  username: string;
  name: string;
}

interface AuthState {
  user: AuthUser | null;
  /** یک بار /api/auth/me چک شده باشد */
  ready: boolean;
  /** دیالوگ ورود/ثبت‌نام باز باشد */
  dialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;

  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (username: string, password: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  dialogOpen: false,
  openDialog: () => set({ dialogOpen: true }),
  closeDialog: () => set({ dialogOpen: false }),

  refresh: async () => {
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await r.json()) as { user: AuthUser | null };
      set({ user: data.user ?? null, ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },

  login: async (username, password) => {
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await r.json()) as { user?: AuthUser; error?: string };
      if (!r.ok || !data.user) return { ok: false, error: data.error ?? "ورود ناموفق بود" };
      set({ user: data.user, dialogOpen: false });
      return { ok: true };
    } catch {
      return { ok: false, error: "ارتباط با سرور برقرار نشد" };
    }
  },

  register: async (username, password, name) => {
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, name }),
      });
      const data = (await r.json()) as { user?: AuthUser; error?: string };
      if (!r.ok || !data.user) return { ok: false, error: data.error ?? "ثبت‌نام ناموفق بود" };
      set({ user: data.user, dialogOpen: false });
      return { ok: true };
    } catch {
      return { ok: false, error: "ارتباط با سرور برقرار نشد" };
    }
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // نادیده — کوکی روی سرور ممکن است بماند ولی کلاینت خروج می‌کند
    }
    set({ user: null });
  },
}));
