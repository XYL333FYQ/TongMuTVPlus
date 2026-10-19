import { act, fireEvent, render, screen } from '@testing-library/react';

import SearchSuggestions from './SearchSuggestions';

const originalFetch = Object.getOwnPropertyDescriptor(global, 'fetch');
const props = {
  query: '星',
  isVisible: true,
  onSelect: jest.fn(),
  onClose: jest.fn(),
  onEnterKey: jest.fn(),
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn(async () => ({
      ok: true,
      json: async () => ({ suggestions: [{ text: '星际穿越' }] }),
    })),
  });
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  if (originalFetch) Object.defineProperty(global, 'fetch', originalFetch);
  else Reflect.deleteProperty(global, 'fetch');
});
async function show() {
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

test('Enter in the search input keeps the existing query submission', async () => {
  render(
    <>
      <input aria-label='片名' />
      <SearchSuggestions {...props} />
    </>
  );
  await show();
  fireEvent.keyDown(screen.getByRole('textbox', { name: '片名' }), {
    key: 'Enter',
  });
  expect(props.onClose).toHaveBeenCalledTimes(1);
  expect(props.onEnterKey).toHaveBeenCalledTimes(1);
});
test('Enter inside a top dialog does not submit the background search', async () => {
  render(
    <>
      <SearchSuggestions {...props} />
      <dialog open>
        <button>弹窗操作</button>
      </dialog>
    </>
  );
  await show();
  expect(
    fireEvent.keyDown(screen.getByRole('button', { name: '弹窗操作' }), {
      key: 'Enter',
    })
  ).toBe(true);
  expect(props.onClose).not.toHaveBeenCalled();
  expect(props.onEnterKey).not.toHaveBeenCalled();
});
test('a suggestion button keeps native Enter activation instead of submitting the original query', async () => {
  render(<SearchSuggestions {...props} />);
  await show();
  const choice = screen.getByRole('button', { name: '星际穿越' });
  expect(fireEvent.keyDown(choice, { key: 'Enter' })).toBe(true);
  fireEvent.click(choice);
  expect(props.onSelect).toHaveBeenCalledWith('星际穿越');
  expect(props.onEnterKey).not.toHaveBeenCalled();
});

test('choosing a suggestion does not also submit its surrounding search form', async () => {
  const submit = jest.fn((event: React.FormEvent) => event.preventDefault());
  render(
    <form onSubmit={submit}>
      <SearchSuggestions {...props} />
    </form>
  );
  await show();
  fireEvent.click(screen.getByRole('button', { name: '星际穿越' }));
  expect(props.onSelect).toHaveBeenCalledWith('星际穿越');
  expect(submit).not.toHaveBeenCalled();
});
