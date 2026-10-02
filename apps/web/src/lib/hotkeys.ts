'use client';

import { useEffect, useRef } from 'react';

export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

interface HotkeyOptions {
  /** Require Cmd (macOS) or Ctrl. */
  mod?: boolean;
  /** Fire even while typing in a field (only sensible with mod). */
  allowInInputs?: boolean;
  enabled?: boolean;
}

/**
 * Registers a single-key shortcut. Plain keys are ignored while typing and
 * whenever Ctrl/Cmd/Alt is held, so browser shortcuts are never hijacked.
 */
export function useHotkey(key: string, handler: (e: KeyboardEvent) => void, options: HotkeyOptions = {}) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  const { mod = false, allowInInputs = false, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      const modPressed = e.metaKey || e.ctrlKey;
      if (mod !== modPressed || e.altKey) return;
      if (!mod && e.shiftKey) return;
      if (!allowInInputs && isTyping(e.target)) return;
      e.preventDefault();
      ref.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, mod, allowInInputs, enabled]);
}
