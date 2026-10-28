import { Suspense } from 'react';

import RoomFilmSelection from '@/features/rooms/RoomFilmSelection';

export default function SelectRoomFilmPage() {
  return (
    <Suspense
      fallback={
        <p className='tm-public-feedback' role='status'>
          正在打开选片…
        </p>
      }
    >
      <RoomFilmSelection />
    </Suspense>
  );
}
