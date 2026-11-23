"use client";

import { useEffect } from "react";

export function RegisterPWA() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore registration failures in unsupported envs */
    });
  }, []);
  return null;
}
