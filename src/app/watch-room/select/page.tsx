import { redirect } from 'next/navigation';

/**
 * 旧的“为房间选片”页：新房间页里直接选片。保留地址，带着影片转到房间页。
 */
export default async function SelectRoomFilmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const film = typeof params.film === 'string' ? params.film : '';
  redirect(
    film ? `/watch-room?${new URLSearchParams({ film })}` : '/watch-room'
  );
}
