import { processImageUrl } from '@/lib/utils';

import type { Room } from '@/types/watch-room';

const COVER_WIDTH = 960;
const COVER_HEIGHT = 540;
/** 与服务端上限（200KB）留出余量 */
const MAX_COVER_BYTES = 190 * 1024;

/**
 * 房间卡片的封面：房主上传的自定义封面优先，其次是正在放映影片的海报，
 * 都没有时返回 null，由界面显示占位。
 */
export function roomCoverSource(
  room: Pick<Room, 'coverUrl' | 'nowPlaying'> | null | undefined
) {
  if (!room) return null;
  if (room.coverUrl) return room.coverUrl;
  const poster = room.nowPlaying?.poster;
  return poster ? processImageUrl(poster) : null;
}

/**
 * 把用户选择的本地图片裁成 16:9、压缩成 JPEG data URL，控制在服务端大小限制内。
 * 在浏览器里完成，不把原图上传到服务器。
 */
export async function compressRoomCover(file: File): Promise<string> {
  if (!/^image\//.test(file.type)) throw new Error('请选择图片文件');
  if (file.size > 20 * 1024 * 1024) throw new Error('图片太大，请换一张');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = COVER_WIDTH;
    canvas.height = COVER_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器不支持处理图片');
    // 居中裁剪成 16:9
    const scale = Math.max(
      COVER_WIDTH / bitmap.width,
      COVER_HEIGHT / bitmap.height
    );
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    context.drawImage(
      bitmap,
      (COVER_WIDTH - width) / 2,
      (COVER_HEIGHT - height) / 2,
      width,
      height
    );
    for (const quality of [0.85, 0.75, 0.65, 0.5]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const bytes = Math.ceil(
        ((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4
      );
      if (bytes <= MAX_COVER_BYTES) return dataUrl;
    }
    throw new Error('图片内容太复杂，压缩后仍然过大，请换一张');
  } finally {
    bitmap.close?.();
  }
}
