'use client';

import { useCallback, useEffect, useRef } from 'react';

/** A media lookup belongs to one selection, room, activity, and mounted page. */
export function useLatestMediaRequest(scope: string) {
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const cancel = useCallback(() => {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel();
    };
  }, [cancel]);
  useEffect(() => () => cancel(), [scope, cancel]);

  const run = useCallback(
    async <T>(
      load: (signal: AbortSignal) => Promise<T>,
      apply: (value: T) => void,
      fail?: (error: unknown) => void,
      finish?: () => void
    ) => {
      cancel();
      const request = new AbortController();
      controller.current = request;
      const operation = generation.current;
      const currentScope = scopeRef.current;
      const isCurrent = () =>
        mounted.current &&
        !request.signal.aborted &&
        generation.current === operation &&
        scopeRef.current === currentScope;
      try {
        const value = await load(request.signal);
        if (isCurrent()) apply(value);
      } catch (error) {
        if (isCurrent()) fail?.(error);
      } finally {
        if (isCurrent()) {
          controller.current = null;
          finish?.();
        }
      }
    },
    [cancel]
  );
  return { run, cancel };
}
