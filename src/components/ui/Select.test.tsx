import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import Select from './Select';

function Harness({ onPick }: { onPick: (value: string) => void }) {
  const [value, setValue] = useState('b');
  return (
    <Select
      aria-label='下载方式'
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        onPick(event.target.value);
      }}
    >
      <option value='a'>Aria2</option>
      <option value='b'>迅雷</option>
      <>
        <option value='c'>qBittorrent</option>
        <option value='d' disabled>
          不可选
        </option>
      </>
      {['e'].map((key) => (
        <option key={key} value={key}>
          末项 {key}
        </option>
      ))}
    </Select>
  );
}

test('shows the current label and never renders a native select', () => {
  const view = render(<Harness onPick={jest.fn()} />);
  expect(view.container.querySelector('select')).toBeNull();
  expect(screen.getByRole('combobox', { name: '下载方式' })).toHaveTextContent(
    '迅雷'
  );
});

test('click opens a listbox and choosing an option fires onChange with its value', () => {
  const onPick = jest.fn();
  render(<Harness onPick={onPick} />);
  fireEvent.click(screen.getByRole('combobox'));
  const options = screen.getAllByRole('option');
  expect(options.map((option) => option.textContent)).toEqual([
    'Aria2',
    '迅雷',
    'qBittorrent',
    '不可选',
    '末项 e',
  ]);
  fireEvent.click(screen.getByRole('option', { name: 'qBittorrent' }));
  expect(onPick).toHaveBeenCalledWith('c');
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(screen.getByRole('combobox')).toHaveTextContent('qBittorrent');
});

test('keyboard: arrows skip disabled items, Enter picks, Escape closes without change', () => {
  const onPick = jest.fn();
  render(<Harness onPick={onPick} />);
  const trigger = screen.getByRole('combobox');
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  const list = screen.getByRole('listbox');
  fireEvent.keyDown(list, { key: 'ArrowDown' }); // 迅雷 -> qBittorrent
  fireEvent.keyDown(list, { key: 'ArrowDown' }); // 跳过不可选 -> 末项
  fireEvent.keyDown(list, { key: 'Enter' });
  expect(onPick).toHaveBeenCalledWith('e');

  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(onPick).toHaveBeenCalledTimes(1);
});

test('a disabled option cannot be chosen', () => {
  const onPick = jest.fn();
  render(<Harness onPick={onPick} />);
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.click(screen.getByRole('option', { name: '不可选' }));
  expect(onPick).not.toHaveBeenCalled();
});
