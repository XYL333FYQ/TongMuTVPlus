import { fireEvent, render, screen } from '@testing-library/react';

import TrailerPickerDialog from './TrailerPickerDialog';

test('the trailer picker opens as a sheet in the shared modal layer and closes on Escape', () => {
  const onClose = jest.fn();
  render(
    <TrailerPickerDialog
      isOpen
      title='验收影片'
      videos={[]}
      onClose={onClose}
      onSelect={jest.fn()}
    />
  );
  const layer = screen.getByRole('dialog', { name: '选择预告片' });
  expect(layer).toHaveClass('tm-modal-layer', 'tm-modal-layer--sheet');
  expect(document.body.style.position).toBe('fixed');
  fireEvent(layer, new Event('cancel', { cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
