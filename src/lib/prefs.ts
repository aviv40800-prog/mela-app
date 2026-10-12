"use client";

import { useSyncExternalStore } from "react";

// Per-device UI preferences (not account data), persisted in localStorage.
export type Prefs = { haptics: boolean; reduceMotion: boolean };
const KEY = "mela:prefs";
const DEFAULTS: Prefs = { haptics: true, reduceMotion: false };
const listeners = new Set<() => void>();
let cache: Prefs | null = null;

function read(): Prefs {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    cache = DEFAULTS;
  }
  return cache!;
}

export function getPrefs(): Prefs {
  return typeof window === "undefined" ? DEFAULTS : read();
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  cache = { ...read(), [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  listeners.forEach((l) => l());
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getPrefs,
    () => DEFAULTS,
  );
}
