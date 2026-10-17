"use client";
import { createBrowserClient as browser } from "@supabase/ssr";
import { config } from "./config";
export function createBrowserClient() {
  const { url, key } = config();
  return browser(url, key);
}
