"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 409 && typeof window !== "undefined") window.location.href = "/onboarding/profile";
    const d = data as { error?: string; code?: string };
    throw new ApiError(res.status, d.error ?? "משהו השתבש", d.code);
  }
  return data as T;
}

import { getPrefs } from "./prefs";

/** Short vibration on supporting devices (Android). Respects the in-app haptics preference. */
export function haptic(pattern: number | number[] = 12) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator) || !getPrefs().haptics) return;
  navigator.vibrate?.(pattern);
}
