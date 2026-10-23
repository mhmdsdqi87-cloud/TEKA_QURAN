"use client";

/**
 * شناسهٔ محلی حافظ — آمار واقعی هر شخص روی دستگاه خودش ذخیره و بازیابی می‌شود.
 */
const KEY = "hafez_uid_v1";

export function getHafezUid(): string {
  if (typeof window === "undefined") return "";
  try {
    let uid = window.localStorage.getItem(KEY);
    if (!uid) {
      uid =
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `u${Date.now()}${Math.random().toString(36).slice(2, 10)}`);
      window.localStorage.setItem(KEY, uid);
    }
    return uid;
  } catch {
    return "anonymous";
  }
}
