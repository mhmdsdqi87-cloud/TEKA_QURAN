"use client";

import { useEffect } from "react";

/**
 * ثبت سرویس‌ورکر — فقط در production (در dev تداخل ایجاد می‌کند)
 */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const t = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }, 1200);
    return () => clearTimeout(t);
  }, []);
  return null;
}
