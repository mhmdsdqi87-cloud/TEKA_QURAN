"use client";

/**
 * تنظیمات کاربر استودیو — با localStorage ماندگار می‌شود
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ErrorAlert = "all" | "beep" | "vibrate" | "silent";
export type Strictness = "lenient" | "normal" | "strict";
export type TextSize = "sm" | "md" | "lg";

export interface StudioSettings {
  /** صداهای برنامه (بوق خطا، تشویق، شمارش معکوس) */
  sounds: boolean;
  /** هشدار لحظه‌ای خطا */
  errorAlert: ErrorAlert;
  /** بلندی صدا 0..1 */
  volume: number;
  /** سخت‌گیری تشخیص تطبیق */
  strictness: Strictness;
  /** پیام لحظه‌ای معلم هوش مصنوعی (توست) */
  liveFeedback: boolean;
  /** تشویق‌های صوتی/متنی */
  praise: boolean;
  /** پیمایش خودکار به آیهٔ فعال */
  autoScroll: boolean;
  /** توقف خودکار در پایان بازه */
  autoStop: boolean;
  /** هایلایت زندهٔ موقت (interim) */
  ghostPreview: boolean;
  /** تمرین کور — کلمات پیش‌رو مخفی می‌شوند تا از حفظ بخوانی */
  hideUpcoming: boolean;
  /** شمارش معکوس ۳-۲-۱ */
  countdown: boolean;
  /** اندازهٔ متن آیات */
  textSize: TextSize;
}

export const defaultSettings: StudioSettings = {
  sounds: true,
  errorAlert: "all",
  volume: 0.7,
  strictness: "normal",
  liveFeedback: true,
  praise: true,
  autoScroll: true,
  autoStop: true,
  ghostPreview: true,
  hideUpcoming: false,
  countdown: true,
  textSize: "md",
};

interface SettingsState extends StudioSettings {
  update: <K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) => void;
  reset: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      update: (key, value) => set({ [key]: value } as Partial<StudioSettings>),
      reset: () => set({ ...defaultSettings }),
    }),
    { name: "hafez-settings-v1" }
  )
);

export const STRICTNESS_LABELS: Record<Strictness, { title: string; hint: string }> = {
  lenient: { title: "آسان‌گیر", hint: "کلمات نزدیک هم پذیرفته می‌شوند — برای شروع و تمرین روان" },
  normal: { title: "متعادل", hint: "تعادل دقیق بین سخت‌گیری و روانی — پیشنهاد ما" },
  strict: { title: "سخت‌گیر", hint: "فقط کلمات بسیار دقیق پذیرفته می‌شوند — برای مرور نهایی حفظ" },
};

export const ERROR_ALERT_LABELS: Record<ErrorAlert, string> = {
  all: "بوق + لرزش گوشی",
  beep: "فقط بوق",
  vibrate: "فقط لرزش",
  silent: "بی‌صدا",
};

export const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  sm: "کوچک",
  md: "متوسط",
  lg: "بزرگ",
};
