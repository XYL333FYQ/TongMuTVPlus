'use client';

import { useEffect, useState } from 'react';

export interface VisualPreferences {
  noBlur: boolean;
  reduceMotion: boolean;
}
const STORAGE_KEY = 'tm-visual-preferences-v1';
const CHANGE_EVENT = 'tm-visual-preferences-change';
const defaults: VisualPreferences = { noBlur: false, reduceMotion: false };
let memoryPreferences = defaults;

function normalize(value: unknown): VisualPreferences {
  const record =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  return {
    noBlur: record.noBlur === true,
    reduceMotion: record.reduceMotion === true,
  };
}
function read(): VisualPreferences {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return memoryPreferences;
  }
}
function apply(preferences: VisualPreferences) {
  memoryPreferences = preferences;
  document.documentElement.dataset.tmNoBlur = String(preferences.noBlur);
  document.documentElement.dataset.tmReducedMotion = String(
    preferences.reduceMotion
  );
}

export function useVisualPreferences() {
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const accept = (value: unknown) => {
      const next = normalize(value);
      apply(next);
      setPreferences(next);
    };
    const changed = (event: Event) =>
      accept((event as CustomEvent<VisualPreferences>).detail);
    const stored = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        const next = read();
        accept(next);
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
      }
    };
    window.addEventListener(CHANGE_EVENT, changed);
    window.addEventListener('storage', stored);
    const initial = read();
    accept(initial);
    setReady(true);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: initial }));
    return () => {
      window.removeEventListener(CHANGE_EVENT, changed);
      window.removeEventListener('storage', stored);
    };
  }, []);

  const update = (patch: Partial<VisualPreferences>) => {
    const next = normalize({ ...preferences, ...patch });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* In-memory preferences still work. */
    }
    apply(next);
    setPreferences(next);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  };
  return { preferences, ready, update };
}
