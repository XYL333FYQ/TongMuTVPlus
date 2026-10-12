import { fireEvent, render, screen } from '@testing-library/react';

import HomeHero from './HomeHero';

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
