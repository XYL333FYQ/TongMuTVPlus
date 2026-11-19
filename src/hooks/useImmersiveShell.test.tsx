import { renderHook } from '@testing-library/react';

import {
  type ImmersiveShellMode,
  useImmersiveShell,
} from './useImmersiveShell';

afterEach(() => {
  delete document.documentElement.dataset.tmImmersive;
});

test('marks the document while mounted and clears it on unmount', () => {
  const { unmount } = renderHook(() => useImmersiveShell('bare'));
  expect(document.documentElement.dataset.tmImmersive).toBe('bare');
  unmount();
  expect(document.documentElement.dataset.tmImmersive).toBeUndefined();
});

test('follows a mode change and does nothing for null', () => {
  const { rerender, unmount } = renderHook(
    ({ mode }: { mode: ImmersiveShellMode | null }) => useImmersiveShell(mode),
    { initialProps: { mode: 'bare' as ImmersiveShellMode | null } }
  );
  rerender({ mode: 'fit' });
  expect(document.documentElement.dataset.tmImmersive).toBe('fit');
  rerender({ mode: 'flush' });
  expect(document.documentElement.dataset.tmImmersive).toBe('flush');
  rerender({ mode: null });
  expect(document.documentElement.dataset.tmImmersive).toBeUndefined();
  unmount();
});
