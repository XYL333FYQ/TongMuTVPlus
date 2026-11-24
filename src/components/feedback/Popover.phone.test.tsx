import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import Select from '@/components/ui/Select';

import Popover from './Popover';

let tier = 'phone';
jest.mock('@/hooks/useDeviceTier', () => ({
  useDeviceTier: () => tier,
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  tier = 'phone';
});

function Harness({ onDismiss = jest.fn(), interactive = true }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={setAnchor}>类型</button>
      {anchor && (
        <Popover
          anchor={anchor}
          onDismiss={onDismiss}
          label='类型'
          interactive={interactive}
        >
          <button>喜剧</button>
        </Popover>
      )}
    </>
  );
}

test.each(['phone', 'phone-landscape'])(
  'on %s a popover rises from the bottom in the shared modal layer',
  (name) => {
    tier = name;
    const onDismiss = jest.fn();
    render(<Harness onDismiss={onDismiss} />);
    const sheet = screen.getByRole('dialog', { name: '类型' });
    expect(sheet).toHaveClass('tm-modal-layer--sheet');
    expect(sheet).toContainElement(
      screen.getByRole('button', { name: '喜剧' })
    );
    expect(document.querySelector('.tm-popover-layer')).toBeNull();
    fireEvent(sheet, new Event('cancel', { cancelable: true }));
    expect(onDismiss).toHaveBeenCalled();
  }
);

test.each(['tablet', 'wide'])(
  'on %s a popover stays next to its button',
  (name) => {
    tier = name;
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('.tm-popover-layer')).not.toBeNull();
  }
);

test('a passive hint stays next to its button even on phones', () => {
  render(<Harness interactive={false} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.querySelector('.tm-popover-layer')).not.toBeNull();
});

test('on phones a select lists its options in a bottom sheet and picks one', () => {
  const onChange = jest.fn();
  render(
    <Select aria-label='清晰度' value='a' onChange={onChange}>
      <option value='a'>自动</option>
      <option value='b'>高清</option>
    </Select>
  );
  fireEvent.click(screen.getByRole('combobox', { name: '清晰度' }));
  const sheet = screen.getByRole('dialog', { name: '清晰度' });
  expect(sheet).toHaveClass('tm-modal-layer--sheet');
  fireEvent.click(screen.getByRole('option', { name: '高清' }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ target: expect.objectContaining({ value: 'b' }) })
  );
  expect(screen.queryByRole('dialog', { name: '清晰度' })).toBeNull();
});
