import { act, fireEvent, render, screen } from '@testing-library/react';

import HomeHero from '@/components/catalog/HomeHero';

jest.mock('@/lib/motion', () => ({ useReducedMotionSetting: () => true }));

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
