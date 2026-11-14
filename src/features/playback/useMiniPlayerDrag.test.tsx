import { act, render } from '@testing-library/react';
import { useRef } from 'react';

import { MINI_PLAYER_OFFSET_KEY, useMiniPlayerDrag } from './useMiniPlayerDrag';

// 1280×800 视口；小窗默认在右下角：画面 360×202，底栏紧贴在下面
const VIEW = { width: 1280, height: 800 };
const MOUNT = { left: 896, top: 530, width: 360, height: 202 };
const CHROME = { left: 896, top: 732, width: 360, height: 44 };

function rect(box: typeof MOUNT, dx: number, dy: number) {
  const left = box.left + dx;
  const top = box.top + dy;
  return {
    left,
    top,
    right: left + box.width,
    bottom: top + box.height,
    width: box.width,
    height: box.height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function Harness({ onClick }: { onClick: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { style } = useMiniPlayerDrag(hostRef, true);
  // 和真实样式一样：画面和底栏都按位移变量平移
  const dx = parseFloat(String(style['--tm-mini-x' as keyof typeof style]));
  const dy = parseFloat(String(style['--tm-mini-y' as keyof typeof style]));
  return (
    <div ref={hostRef} data-testid='host' data-x={dx} data-y={dy}>
      <div
        data-tm-player-mount=''
        data-testid='mount'
        ref={(node) => {
          if (node) node.getBoundingClientRect = () => rect(MOUNT, dx, dy);
        }}
      />
      <div
        className='tm-playback-chrome'
        ref={(node) => {
          if (node) node.getBoundingClientRect = () => rect(CHROME, dx, dy);
        }}
      >
        <button onClick={onClick}>静音本机</button>
      </div>
    </div>
  );
}

function pointer(type: string, target: EventTarget, x: number, y: number) {
  act(() => {
    target.dispatchEvent(
      new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 })
    );
  });
}

const offsetOf = (host: HTMLElement) => ({
  x: Number(host.dataset.x),
  y: Number(host.dataset.y),
});

beforeEach(async () => {
  // 让上一个用例拖动后留下的“吞掉下一次点击”监听按时撤掉
  await new Promise((resolve) => setTimeout(resolve, 0));
  window.localStorage.clear();
  Object.assign(window, { innerWidth: VIEW.width, innerHeight: VIEW.height });
});

test('dragging toward the top-left snaps to that corner and is remembered', () => {
  const view = render(<Harness onClick={jest.fn()} />);
  const host = view.getByTestId('host');
  const mount = view.getByTestId('mount');

  pointer('pointerdown', mount, 1000, 600);
  pointer('pointermove', window, 400, 300);
  pointer('pointerup', window, 400, 300);

  // 左边距 24，顶部让开导航 72
  expect(offsetOf(host)).toEqual({ x: 24 - 896, y: 72 - 530 });
  expect(
    JSON.parse(window.localStorage.getItem(MINI_PLAYER_OFFSET_KEY)!)
  ).toEqual({ x: 24 - 896, y: 72 - 530 });

  view.unmount();
  const again = render(<Harness onClick={jest.fn()} />);
  expect(offsetOf(again.getByTestId('host'))).toEqual({
    x: 24 - 896,
    y: 72 - 530,
  });
});

test('cannot be dragged below its default position or off screen', () => {
  const view = render(<Harness onClick={jest.fn()} />);
  const host = view.getByTestId('host');
  pointer('pointerdown', view.getByTestId('mount'), 1000, 600);
  pointer('pointermove', window, 1900, 1400);
  expect(offsetOf(host)).toEqual({ x: 0, y: 0 });
  pointer('pointerup', window, 1900, 1400);
  expect(offsetOf(host)).toEqual({ x: 0, y: 0 });
});

test('a tiny movement is still a click, a real drag does not trigger the button', () => {
  const onClick = jest.fn();
  const view = render(<Harness onClick={onClick} />);
  const button = view.getByRole('button', { name: '静音本机' });

  pointer('pointerdown', button, 1000, 750);
  pointer('pointermove', window, 1003, 752);
  pointer('pointerup', window, 1003, 752);
  act(() => button.click());
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(offsetOf(view.getByTestId('host'))).toEqual({ x: 0, y: 0 });

  pointer('pointerdown', button, 1000, 750);
  pointer('pointermove', window, 500, 400);
  pointer('pointerup', window, 500, 400);
  act(() => button.click());
  expect(onClick).toHaveBeenCalledTimes(1);
});
