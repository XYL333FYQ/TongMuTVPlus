import { Suspense } from 'react';

import RoomWorkspace from '@/features/rooms/RoomWorkspace';

export default function WatchRoomPage() {
  return (
    <Suspense fallback={null}>
      <RoomWorkspace />
    </Suspense>
  );
}
