"use client";
import Script from "next/script";
import { useEffect, useRef } from "react";
type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (id: string) => void;
};
const api = () => (window as { turnstile?: TurnstileApi }).turnstile;
/**
 * Cloudflare Turnstile. Remount it (change its key) to get a fresh single-use token.
 * `action` must match the one the server checks for this form.
 */
export function Turnstile({
  action,
  onToken,
}: {
  action: "book_room" | "book_table";
  onToken: (token: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(
    () => () => {
      if (widget.current) api()?.remove(widget.current);
    },
    [],
  );
  if (!siteKey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => {
          if (!api() || !box.current || widget.current) return;
          widget.current = api()!.render(box.current, {
            sitekey: siteKey,
            action,
            callback: onToken,
            "expired-callback": () => onToken(""),
            "error-callback": () => onToken(""),
          });
        }}
      />
      <div ref={box} className="captcha" />
    </>
  );
}
