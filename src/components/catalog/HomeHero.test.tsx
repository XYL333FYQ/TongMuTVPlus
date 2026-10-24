import { act, fireEvent, render, screen } from '@testing-library/react';

import HomeHero from '@/components/catalog/HomeHero';

let mockReducedMotion = true;
jest.mock('@/lib/motion', () => ({
  useReducedMotionSetting: () => mockReducedMotion,
}));
afterEach(() => {
  mockReducedMotion = true;
});

const stageProps = {
  id: 'a',
  title: '甲',
  meta: '2026',
  contain: true,
  art: <img src='/a.jpg' alt='当前海报' />,
  deck: [
    { id: 'a', title: '甲', src: '/a.jpg' },
    { id: 'b', title: '乙', src: '/b.jpg' },
    { id: 'c', title: '丙', src: '/c.jpg' },
  ],
  titles: ['甲', '乙', '丙'],
  index: 0,
  onPlay: jest.fn(),
  onTogether: jest.fn(),
};

test('portrait stage exposes both upcoming films and keeps their actual indices', () => {
  const onSelect = jest.fn();
  const onDetail = jest.fn();
  render(<HomeHero {...stageProps} onSelect={onSelect} onDetail={onDetail} />);
  fireEvent.click(screen.getByRole('button', { name: '切换推荐：乙' }));
  fireEvent.click(screen.getByRole('button', { name: '切换推荐：丙' }));
  expect(onSelect.mock.calls).toEqual([[1], [2]]);
  fireEvent.click(screen.getByRole('button', { name: '查看影片详情：甲' }));
  expect(onDetail).toHaveBeenCalledTimes(1);
});

test('arrow controls wrap at either end and keyboard navigation stays inside the hero', () => {
  const onSelect = jest.fn();
  render(<HomeHero {...stageProps} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole('button', { name: '上一部推荐' }));
  fireEvent.click(screen.getByRole('button', { name: '下一部推荐' }));
  fireEvent.keyDown(screen.getByRole('region', { name: '精选推荐' }), {
    key: 'End',
  });
  fireEvent.keyDown(screen.getByRole('region', { name: '精选推荐' }), {
    key: 'ArrowLeft',
  });
  expect(onSelect.mock.calls).toEqual([[2], [1], [2], [2]]);
  fireEvent.keyDown(document.body, { key: 'ArrowRight' });
  expect(onSelect).toHaveBeenCalledTimes(4);
});

test('cover controls expose automatic progress without a persistent pause button', () => {
  mockReducedMotion = false;
  render(<HomeHero {...stageProps} onSelect={jest.fn()} />);
  expect(
    screen.queryByRole('button', { name: /暂停自动切换|启用自动切换/ })
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('progressbar', { name: '封面自动切换进度' })
  ).toBeInTheDocument();
});

test('a two-film stage has one neighbor and a single-film stage has no dead controls', () => {
  const { rerender } = render(
    <HomeHero
      {...stageProps}
      deck={stageProps.deck.slice(0, 2)}
      titles={['甲', '乙']}
      onSelect={jest.fn()}
    />
  );
  expect(screen.getAllByRole('button', { name: '切换推荐：乙' })).toHaveLength(
    1
  );
  expect(
    screen.queryByRole('button', { name: '切换推荐：甲' })
  ).not.toBeInTheDocument();
  rerender(
    <HomeHero
      {...stageProps}
      deck={[stageProps.deck[0]]}
      titles={['甲']}
      onSelect={jest.fn()}
    />
  );
  expect(
    screen.queryByRole('button', { name: '下一部推荐' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: '上一部推荐' })
  ).not.toBeInTheDocument();
});

test('an unavailable main poster settles into a visible fallback rather than an endless loading state', () => {
  jest.useFakeTimers();
  try {
    render(<HomeHero {...stageProps} onSelect={jest.fn()} />);
    act(() => jest.advanceTimersByTime(5000));
    expect(
      screen.getByRole('img', { name: '海报暂时无法加载' })
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '精选推荐' })).toHaveAttribute(
      'aria-busy',
      'false'
    );
  } finally {
    jest.useRealTimers();
  }
});

test('changing a film preserves focus on its action', () => {
  const onSelect = jest.fn();
  const { rerender } = render(<HomeHero {...stageProps} onSelect={onSelect} />);
  const play = screen.getByRole('button', { name: '播放' });
  act(() => play.focus());
  fireEvent.keyDown(play, { key: 'ArrowRight' });
  expect(onSelect).toHaveBeenCalledWith(1);
  rerender(
    <HomeHero
      {...stageProps}
      id='b'
      title='乙'
      index={1}
      art={<img src='/b.jpg' alt='乙海报' />}
      onSelect={onSelect}
    />
  );
  expect(screen.getByRole('button', { name: '播放' })).toHaveFocus();
});

test('the shared hero supports guest swipes without caller handlers and preserves vertical scrolling', () => {
  const onSelect = jest.fn();
  render(<HomeHero {...stageProps} onSelect={onSelect} />);
  const hero = screen.getByRole('region', { name: '精选推荐' });
  fireEvent.touchStart(hero, { touches: [{ clientX: 300, clientY: 100 }] });
  fireEvent.touchMove(hero, { touches: [{ clientX: 210, clientY: 450 }] });
  fireEvent.touchEnd(hero);
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.touchStart(hero, { touches: [{ clientX: 0, clientY: 200 }] });
  fireEvent.touchMove(hero, { touches: [{ clientX: 90, clientY: 205 }] });
  fireEvent.touchEnd(hero);
  expect(onSelect).toHaveBeenCalledWith(2);
});

test('up-next thumbnails select the original carousel index', () => {
  const onSelect = jest.fn();
  render(
    <HomeHero
      id='a'
      title='甲'
      meta=''
      contain
      art={<img src='/a.jpg' alt='当前海报' />}
      deck={[
        { id: 'a', title: '甲', src: '/a.jpg' },
        { id: 'b', title: '乙', src: '/b.jpg' },
      ]}
      titles={['甲', '乙']}
      index={0}
      onSelect={onSelect}
      onPlay={jest.fn()}
      onTogether={jest.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: '切换推荐：乙' }));
  expect(onSelect).toHaveBeenCalledWith(1);
});

test('detects portrait art despite backdrop metadata and resets for the next image', () => {
  const props = {
    id: 'portrait',
    title: '影片',
    meta: '2026',
    contain: false,
    art: <img src='/portrait.jpg' alt='影片海报' />,
    onPlay: jest.fn(),
    onTogether: jest.fn(),
    titles: ['影片'],
    index: 0,
    onSelect: jest.fn(),
  };
  const { container, rerender } = render(<HomeHero {...props} />);
  const image = screen.getByAltText('影片海报');
  Object.defineProperties(image, {
    naturalWidth: { value: 600 },
    naturalHeight: { value: 900 },
  });
  fireEvent.load(image);
  expect(container.querySelector('.tm-home-hero-panel')).toHaveAttribute(
    'data-portrait',
    'true'
  );
  rerender(
    <HomeHero
      {...props}
      id='landscape'
      art={<img src='/landscape.jpg' alt='剧照' />}
    />
  );
  expect(container.querySelector('.tm-home-hero-panel')).toHaveAttribute(
    'data-portrait',
    'false'
  );
  const landscape = screen.getByAltText('剧照');
  Object.defineProperties(landscape, {
    naturalWidth: { value: 1600 },
    naturalHeight: { value: 900 },
  });
  fireEvent.load(landscape);
  expect(container.querySelector('.tm-home-hero-panel')).toHaveAttribute(
    'data-portrait',
    'false'
  );
  fireEvent.click(screen.getByRole('button', { name: '播放' }));
  fireEvent.click(screen.getByRole('button', { name: '一起看' }));
  expect(props.onPlay).toHaveBeenCalledTimes(1);
  expect(props.onTogether).toHaveBeenCalledTimes(1);
});

test('retains the last loaded poster until the incoming poster is ready', () => {
  const props = {
    id: 'first',
    title: '第一部',
    meta: '2026',
    contain: true,
    art: <img src='/first.jpg' alt='第一部海报' />,
    onPlay: jest.fn(),
    onTogether: jest.fn(),
    titles: ['第一部', '第二部'],
    index: 0,
    onSelect: jest.fn(),
  };
  const { rerender } = render(<HomeHero {...props} />);
  const first = screen.getByAltText('第一部海报');
  Object.defineProperties(first, {
    naturalWidth: { value: 600 },
    naturalHeight: { value: 900 },
  });
  fireEvent.load(first);
  rerender(
    <HomeHero
      {...props}
      id='second'
      title='第二部'
      index={1}
      art={<img src='/second.jpg' alt='第二部海报' />}
    />
  );
  expect(
    screen.getByAltText('第一部海报').closest('.tm-home-hero-frame')
  ).toHaveAttribute('data-ready', 'true');
  expect(
    screen.getByAltText('第二部海报').closest('.tm-home-hero-frame')
  ).toHaveAttribute('data-ready', 'false');
  const second = screen.getByAltText('第二部海报');
  Object.defineProperties(second, {
    naturalWidth: { value: 600 },
    naturalHeight: { value: 900 },
  });
  fireEvent.load(second);
  expect(second.closest('.tm-home-hero-frame')).toHaveAttribute(
    'data-ready',
    'true'
  );
});

test('remembers a measured portrait when returning before its next load event', () => {
  const props = {
    id: 'first',
    title: '影片',
    meta: '',
    contain: false,
    art: <img src='/first.jpg' alt='首张海报' />,
    onPlay: jest.fn(),
    onTogether: jest.fn(),
    titles: ['影片'],
    index: 0,
    onSelect: jest.fn(),
  };
  const { container, rerender } = render(<HomeHero {...props} />);
  Object.defineProperties(screen.getByAltText('首张海报'), {
    naturalWidth: { value: 600 },
    naturalHeight: { value: 900 },
  });
  fireEvent.load(screen.getByAltText('首张海报'));
  rerender(
    <HomeHero
      {...props}
      id='other'
      art={<img src='/other.jpg' alt='另一张剧照' />}
    />
  );
  Object.defineProperties(screen.getByAltText('另一张剧照'), {
    naturalWidth: { value: 1600 },
    naturalHeight: { value: 900 },
  });
  fireEvent.load(screen.getByAltText('另一张剧照'));
  rerender(<HomeHero {...props} />);
  expect(container.querySelector('.tm-home-hero-panel')).toHaveAttribute(
    'data-portrait',
    'true'
  );
});

test('a departing image finishing decode cannot mark the next image ready', async () => {
  const props = {
    id: 'a',
    title: '影片',
    meta: '',
    contain: true,
    art: <img src='/a.jpg' alt='A海报' />,
    onPlay: jest.fn(),
    onTogether: jest.fn(),
    titles: ['影片'],
    index: 0,
    onSelect: jest.fn(),
  };
  const { container, rerender } = render(<HomeHero {...props} />);
  Object.defineProperties(screen.getByAltText('A海报'), {
    naturalWidth: { value: 600 },
    naturalHeight: { value: 900 },
  });
  fireEvent.load(screen.getByAltText('A海报'));
  rerender(
    <HomeHero {...props} id='b' art={<img src='/b.jpg' alt='B剧照' />} />
  );
  let finishDecode: () => void = () => undefined;
  const decoding = new Promise<void>((resolve) => {
    finishDecode = resolve;
  });
  Object.defineProperties(screen.getByAltText('B剧照'), {
    naturalWidth: { value: 1600 },
    naturalHeight: { value: 900 },
    complete: { value: true },
    decode: { value: () => decoding },
  });
  fireEvent.load(screen.getByAltText('B剧照'));
  rerender(
    <HomeHero {...props} id='c' art={<img src='/c.jpg' alt='C海报' />} />
  );
  await act(async () => {
    finishDecode();
    await decoding;
  });
  expect(
    screen.getByAltText('C海报').closest('.tm-home-hero-frame')
  ).toHaveAttribute('data-ready', 'false');
  expect(container.querySelector('.tm-home-hero-panel')).toHaveAttribute(
    'data-portrait',
    'true'
  );
});
