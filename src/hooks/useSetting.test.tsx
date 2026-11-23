import { act, render, screen } from '@testing-library/react';

import { useSetting } from './useSetting';

beforeEach(() => localStorage.clear());

function Reader({ id }: { id: string }) {
  const [value] = useSetting('subtitleSize');
  return <span data-testid={id}>{value ?? 'none'}</span>;
}

function Writer() {
  const [, setValue] = useSetting('subtitleSize');
  return (
    <>
      <button onClick={() => setValue('3em')}>big</button>
      <button onClick={() => setValue(null)}>reset</button>
    </>
  );
}

test('two components on the same key stay in step', () => {
  render(
    <>
      <Reader id='a' />
      <Writer />
    </>
  );
  expect(screen.getByTestId('a').textContent).toBe('none');
  act(() => screen.getByText('big').click());
  expect(screen.getByTestId('a').textContent).toBe('3em');
  expect(localStorage.getItem('subtitleSize')).toBe('3em');
  act(() => screen.getByText('reset').click());
  expect(screen.getByTestId('a').textContent).toBe('none');
  expect(localStorage.getItem('subtitleSize')).toBeNull();
});

test('a write in another tab re-renders the reader', () => {
  render(<Reader id='b' />);
  act(() => {
    localStorage.setItem('subtitleSize', '4em');
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'subtitleSize', newValue: '4em' })
    );
  });
  expect(screen.getByTestId('b').textContent).toBe('4em');
});
