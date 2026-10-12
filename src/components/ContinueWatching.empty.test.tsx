import { render, screen, waitFor } from '@testing-library/react';

import ContinueWatching from './ContinueWatching';

jest.mock('@/lib/db.client', () => ({
  getCachedPlayRecordsSnapshot: () => ({}),
  getAllPlayRecords: async () => ({}),
  subscribeToDataUpdates: () => jest.fn(),
  clearAllPlayRecords: jest.fn(),
}));
jest.mock('@/components/PlayRecordsPanel', () => () => null);
jest.mock('@/components/VideoCard', () => () => null);
jest.mock('@/components/VirtualScrollableRow', () => () => null);

test('hides the entire homepage continue section after an empty records response', async () => {
  const { container } = render(<ContinueWatching homeLayout />);
  await waitFor(() =>
    expect(screen.queryByText('继续观看')).not.toBeInTheDocument()
  );
  expect(container.querySelector('section')).toBeNull();
});
