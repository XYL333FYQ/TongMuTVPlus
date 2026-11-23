import { fireEvent, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

import Drawer from './Drawer';

test('the drawer opens in the drawer variant of the shared modal layer', () => {
  const onClose = jest.fn();
  render(
    <Drawer isOpen onClose={onClose} title='搜索网盘资源'>
      内容
    </Drawer>
  );
  const dialog = screen.getByRole('dialog', { name: '搜索网盘资源' });
  expect(dialog).toHaveClass('tm-modal-layer', 'tm-modal-layer--drawer');
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('a closed drawer renders nothing', () => {
  render(
    <Drawer isOpen={false} onClose={jest.fn()} title='搜索网盘资源'>
      内容
    </Drawer>
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [full]
      : [];
  });
}

test('the two legacy drawer layers are gone from the whole site', () => {
  const offenders = sourceFiles(path.join(process.cwd(), 'src')).filter(
    (file) =>
      /tm-drawer-layer|tm-download-modal-layer/.test(
        fs.readFileSync(file, 'utf8')
      )
  );
  expect(offenders).toEqual([]);
});
