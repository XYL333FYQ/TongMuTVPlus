import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { useState } from 'react';

import Popover from './Popover';

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);

let panelWidth = 200;
let panelHeight = 100;
beforeAll(() => {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: 400,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: 800,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('tm-popover-layer') ? panelWidth : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('tm-popover-layer') ? panelHeight : 0;
    },
  });
});
afterEach(() => {
  panelWidth = 200;
  panelHeight = 100;
  cleanup();
});

function Harness({
  at,
  onDismiss = jest.fn(),
  inDialog = false,
  ...props
}: {
  at: DOMRect;
  onDismiss?: jest.Mock;
  inDialog?: boolean;
} & Partial<React.ComponentProps<typeof Popover>>) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const button = (
    <button
      ref={(node) => {
        if (node) node.getBoundingClientRect = () => at;
        setAnchor(node);
      }}
    >
      筛选
    </button>
  );
  return (
    <>
      {inDialog ? <dialog open>{button}</dialog> : button}
      <p>页面</p>
      {anchor && (
        <Popover anchor={anchor} onDismiss={onDismiss} label='选项' {...props}>
          <button>选项一</button>
        </Popover>
      )}
    </>
  );
}

const layer = () => {
  const node = document.querySelector<HTMLElement>('.tm-popover-layer');
  if (!node) throw new Error('浮层没有打开');
  return node;
};

test('opens below the button, measured and visible, as a guest of the page', () => {
  render(<Harness at={rect(20, 100, 80, 40)} />);
  expect(layer().parentElement).toBe(document.body);
  expect(layer()).toHaveAttribute('data-tm-layer-guest');
  expect(layer().style.visibility).toBe('');
  expect(layer().style.left).toBe('20px');
  expect(layer().style.top).toBe('146px');
});

test('lives inside the open dialog its button is in, so it can be clicked', () => {
  render(<Harness at={rect(20, 100, 80, 40)} inDialog />);
  expect(layer().parentElement).toBe(document.querySelector('dialog'));
});

test('flips above when there is more room above than below', () => {
  panelHeight = 300;
  render(<Harness at={rect(20, 700, 80, 40)} />);
  expect(layer()).toHaveAttribute('data-up');
  expect(layer().style.bottom).toBe(`${800 - 700 + 6}px`);
  expect(layer().style.top).toBe('');
});

test('right-aligned layers stay on screen', () => {
  render(<Harness at={rect(300, 10, 80, 40)} align='end' />);
  expect(layer().style.left).toBe(`${380 - 200}px`);
  panelWidth = 360;
  cleanup();
  render(<Harness at={rect(-20, 10, 80, 40)} edge={16} />);
  expect(layer().style.left).toBe('16px');
});

test('a fixed width shrinks to the screen', () => {
  render(<Harness at={rect(0, 10, 80, 40)} width={600} edge={12} />);
  expect(layer().style.width).toBe(`${400 - 24}px`);
});

test('a press outside closes it; a press on it or on its button does not', () => {
  const onDismiss = jest.fn();
  render(<Harness at={rect(20, 100, 80, 40)} onDismiss={onDismiss} />);
  fireEvent.pointerDown(screen.getByText('选项一'));
  fireEvent.pointerDown(screen.getByText('筛选'));
  expect(onDismiss).not.toHaveBeenCalled();
  fireEvent.pointerDown(screen.getByText('页面'));
  expect(onDismiss).toHaveBeenCalledWith('outside');
});

test('Escape closes only the layer, not the dialog under it', () => {
  const onDismiss = jest.fn();
  render(<Harness at={rect(20, 100, 80, 40)} onDismiss={onDismiss} inDialog />);
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  });
  const dialogHeard = jest.fn();
  document.querySelector('dialog')?.addEventListener('keydown', dialogHeard);
  act(() => {
    screen.getByText('筛选').dispatchEvent(event);
  });
  expect(onDismiss).toHaveBeenCalledWith('escape');
  expect(event.defaultPrevented).toBe(true);
  expect(dialogHeard).not.toHaveBeenCalled();
});

test('a passive hint lets presses through', () => {
  render(<Harness at={rect(20, 100, 80, 40)} interactive={false} />);
  expect(layer()).toHaveAttribute('data-passive');
});

test('a dialog opened above the layer keeps its own Escape and presses', () => {
  const onDismiss = jest.fn();
  render(<Harness at={rect(20, 100, 80, 40)} onDismiss={onDismiss} />);
  const above = document.createElement('dialog');
  above.setAttribute('open', '');
  const inside = document.createElement('button');
  above.appendChild(inside);
  document.body.appendChild(above);
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    inside.dispatchEvent(event);
  });
  fireEvent.pointerDown(inside);
  expect(onDismiss).not.toHaveBeenCalled();
  expect(event.defaultPrevented).toBe(false);
  above.remove();
});
