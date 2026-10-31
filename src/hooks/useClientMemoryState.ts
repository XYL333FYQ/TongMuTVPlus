'use client';

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  clientMemoryScope,
  readClientMemory,
  writeClientMemory,
} from '@/lib/client-memory';

/** useState for small client UI state that should survive a tab unmount. */
export function useClientMemoryState<T>(
  key: string,
  initialValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const scope = clientMemoryScope();
  const stateKey = scope ? key : '';
  const initial = useRef(initialValue);
  initial.current = initialValue;
  const create = () => {
    const cached = readClientMemory<T>(key, scope);
    return {
      key: stateKey,
      scope,
      restored: cached !== undefined,
      value:
        cached !== undefined
          ? cached
          : typeof initial.current === 'function'
          ? (initial.current as () => T)()
          : initial.current,
    };
  };
  const [entry, setEntry] = useState(create);
  // Reset before committing effects/children for a different page or account.
  // The conditional update belongs to this same component and converges once.
  if (entry.key !== stateKey || entry.scope !== scope) setEntry(create());
  useEffect(() => {
    if (entry.key === stateKey && entry.scope === scope)
      writeClientMemory(key, entry.value, scope);
  }, [entry, key, scope, stateKey]);
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      setEntry((previous) => {
        if (previous.key !== stateKey || previous.scope !== scope)
          return previous;
        return {
          ...previous,
          value:
            typeof next === 'function'
              ? (next as (value: T) => T)(previous.value)
              : next,
        };
      });
    },
    [stateKey, scope]
  );
  return [entry.value, setValue, entry.restored];
}
