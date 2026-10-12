'use client';
import { LayoutGroup } from 'framer-motion';
import { type ReactNode, createContext, useContext } from 'react';

import { useReducedMotionSetting } from '@/lib/motion';

const ShellReducedMotion = createContext(true);
export const useShellReducedMotion = () => useContext(ShellReducedMotion);
// Share navigation projection across App Router pages without a DOM wrapper.
export default function ShellMotionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const reduced = useReducedMotionSetting();
  return (
    <ShellReducedMotion.Provider value={reduced}>
      <LayoutGroup id='tm-site-shell'>{children}</LayoutGroup>
    </ShellReducedMotion.Provider>
  );
}
