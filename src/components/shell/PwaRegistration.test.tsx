import { render, waitFor } from '@testing-library/react';

import PwaRegistration from './PwaRegistration';

test('production uses one worker script without replacing the registration', async () => {
  const register = jest.fn().mockResolvedValue({ active: {} });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register },
  });
  const view = render(<PwaRegistration enabled />);
  await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
  expect(register).toHaveBeenCalledWith('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  });
  view.rerender(<PwaRegistration enabled />);
  expect(register).toHaveBeenCalledTimes(1);
});

test('disabled builds do not register a missing generated worker', () => {
  const register = jest.fn();
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register },
  });
  render(<PwaRegistration enabled={false} />);
  expect(register).not.toHaveBeenCalled();
});
