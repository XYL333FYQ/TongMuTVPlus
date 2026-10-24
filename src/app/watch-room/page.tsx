import { Suspense } from 'react';

import RoomWorkspace from '@/features/rooms/RoomWorkspace';

export default function WatchRoomPage() {
  return (
    <Suspense
      fallback={
        <div className='tm-public-feedback' role='status'>
          正在进入房间…
        </div>
      }
    >
      <RoomWorkspace />
    </Suspense>
  );
}
