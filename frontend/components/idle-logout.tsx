"use client";
import { startTransition, useEffect } from "react";
import { idleLogoutAction } from "@/app/login/actions";
const limit = 5 * 60 * 1000;
const key = "cp-staff-last-activity";
const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"];
/**
 * Signs staff and admin out after 5 minutes without input. Tabs share one session,
 * so the last activity is shared through localStorage and any active tab keeps all of them signed in.
 * shortcut: enforced in the browser only; a closed tab's session lives on until Supabase expires it.
 * Upgrade to Supabase's inactivity timeout (Pro plan) if server-side enforcement is needed.
 */
export function IdleLogout() {
  useEffect(() => {
    let last = Date.now();
    const touch = () => {
      last = Date.now();
      try {
        localStorage.setItem(key, String(last));
      } catch {}
    };
    const latest = () => {
      try {
        return Math.max(last, Number(localStorage.getItem(key)) || 0);
      } catch {
        return last;
      }
    };
    // Throttled: pointermove fires constantly.
    const onActivity = () => {
      if (Date.now() - last > 5000) touch();
    };
    touch();
    events.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );
    const timer = setInterval(() => {
      if (Date.now() - latest() < limit) return;
      clearInterval(timer);
      startTransition(() => idleLogoutAction());
    }, 15000);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, []);
  return null;
}
