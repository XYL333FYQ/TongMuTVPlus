import { fireEvent, render, screen } from '@testing-library/react';

import DoubanCustomSelector from './DoubanCustomSelector';
import DoubanSelector from './DoubanSelector';
import MultiLevelSelector from './MultiLevelSelector';
import WeekdaySelector from './WeekdaySelector';

jest.mock('@/lib/motion', () => ({ useReducedMotionSetting: () => false }));

test('movie selection stays controlled and calls the original category value once', () => {
  const primary = jest.fn(),
    secondary = jest.fn();
  const props = {
    type: 'movie' as const,
    primarySelection: '热门',
    secondarySelection: '全部',
    onPrimaryChange: primary,
    onSecondaryChange: secondary,
    onWeekdayChange: jest.fn(),
  };
  const { rerender } = render(<DoubanSelector {...props} />);
  expect(screen.getByRole('button', { name: '热门电影' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  fireEvent.click(screen.getByRole('button', { name: '最新电影' }));
  expect(primary).toHaveBeenCalledTimes(1);
  expect(primary).toHaveBeenCalledWith('最新');
  expect(secondary).not.toHaveBeenCalled();
  rerender(<DoubanSelector {...props} primarySelection='最新' />);
  expect(screen.getByRole('button', { name: '最新电影' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('anime schedule still sends the original daily category and view mode', () => {
  const primary = jest.fn(),
    view = jest.fn();
  render(
    <DoubanSelector
      type='anime'
      primarySelection='每日放送'
      viewMode='schedule'
      onPrimaryChange={primary}
      onSecondaryChange={jest.fn()}
      onWeekdayChange={jest.fn()}
      onViewModeChange={view}
    />
  );
  expect(screen.getByRole('button', { name: '时刻表' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  fireEvent.click(screen.getByRole('button', { name: '时刻表' }));
  expect(primary).toHaveBeenCalledTimes(1);
  expect(primary).toHaveBeenCalledWith('每日放送');
  expect(view).toHaveBeenCalledTimes(1);
  expect(view).toHaveBeenCalledWith('schedule');
});

test('custom categories retain movie-first grouping and original query values', () => {
  const secondary = jest.fn();
  render(
    <DoubanCustomSelector
      customCategories={[
        { name: '剧集片单', type: 'tv', query: '电视剧' },
        { name: '电影片单', type: 'movie', query: '经典' },
      ]}
      primarySelection='movie'
      secondarySelection='经典'
      onPrimaryChange={jest.fn()}
      onSecondaryChange={secondary}
    />
  );
  expect(screen.getAllByRole('button').map((n) => n.textContent)).toEqual([
    '电影',
    '剧集',
    '电影片单',
  ]);
  expect(screen.getByRole('button', { name: '电影片单' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  fireEvent.click(screen.getByRole('button', { name: '电影片单' }));
  expect(secondary).toHaveBeenCalledTimes(1);
  expect(secondary).toHaveBeenCalledWith('经典');
});

test('weekday initialization and click retain their original values without extra callbacks', () => {
  const changed = jest.fn();
  render(<WeekdaySelector onWeekdayChange={changed} />);
  expect(changed).toHaveBeenCalledTimes(1);
  changed.mockClear();
  fireEvent.click(screen.getByRole('button', { name: '周一' }));
  expect(changed).toHaveBeenCalledTimes(1);
  expect(changed).toHaveBeenCalledWith('Mon');
  expect(screen.getByRole('button', { name: '周一' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('filter selection keeps its original complete payload and closes the options', () => {
  const changed = jest.fn();
  render(<MultiLevelSelector onChange={changed} contentType='movie' />);
  const trigger = screen.getByRole('button', { name: '类型' });
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('button', { name: '喜剧' }));
  expect(changed).toHaveBeenCalledTimes(1);
  expect(changed).toHaveBeenCalledWith({
    type: '喜剧',
    region: 'all',
    year: 'all',
    platform: 'all',
    label: 'all',
    sort: 'T',
  });
  expect(screen.getByRole('button', { name: '喜剧' })).toHaveAttribute(
    'aria-expanded',
    'false'
  );
});
