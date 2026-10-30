'use client';

import { useEffect, useState } from 'react';

export interface VisualPreferences {
  noBlur: boolean;
  reduceMotion: boolean;
  /** 房间里滚动页面时，播放窗口缓动跟随（默认关：滚动时窗口紧贴页面） */
  playerEase: boolean;
}
const STORAGE_KEY = 'tm-visual-preferences-v1';
const CHANGE_EVENT = 'tm-visual-preferences-change';
const defaults: VisualPreferences = {
  noBlur: false,
  reduceMotion: false,
  playerEase: false,
};
let memoryPreferences = defaults;

function inClientShell() {
  return typeof window !== 'undefined' && Boolean(window.TMShell);
}

function normalize(value: unknown): VisualPreferences {
  const record =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  return {
    // 没设置过时：客户端壳（手机 App）默认关闭模糊——WebView 里实时模糊很吃力，滚动和动效会卡；
    // 用户在显示设置里明确选过就按用户的来。
    noBlur:
      typeof record.noBlur === 'boolean' ? record.noBlur : inClientShell(),
    reduceMotion: record.reduceMotion === true,
    playerEase: record.playerEase === true,
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
  document.documentElement.dataset.tmPlayerEase = String(
    preferences.playerEase
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
