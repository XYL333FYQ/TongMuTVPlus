'use client';

/*
 * 把 ChatPanel 接到房间连接上。房间页侧栏和其他页面的聊天浮窗共用。
 */

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import { useWatchRoomContext } from '@/components/WatchRoomProvider';

import ChatPanel from './ChatPanel';
import { useTogetherSession } from '../session/context';

export default function RoomChat({ compact }: { compact?: boolean }) {
  const room = useWatchRoomContext();
  const session = useTogetherSession();
  const current = room.currentRoom;
  if (!current) return null;
  const can = (permission: string) =>
    !!current.myPermissions?.includes(permission as never);
  return (
    <ChatPanel
      key={current.id}
      compact={compact}
      messages={room.chatMessages}
      self={getAuthInfoFromBrowserCookie()?.username || ''}
      connected={room.isConnected}
      canChat={
        (can('chat') && current.settings?.chatEnabled !== false) ||
        can('manageMembers')
      }
      canModerate={can('manageMembers')}
      danmaku={session.danmakuChat}
      onDanmakuChange={session.setDanmakuChat}
      onSend={(content, type) =>
        // 带命令号：网络抖动重发时服务器不会记成两条
        room.roomCommand('chat:message', {
          content,
          type,
          roomId: current.id,
          commandId: crypto.randomUUID(),
        })
      }
      onDelete={(id) => void room.deleteChatMessage(id).catch(() => undefined)}
      onLoadOlder={async () =>
        (await room.loadChatHistory(undefined, room.chatMessages[0]?.seq))
          .length
      }
      onRead={(seq) => void room.markChatRead(seq).catch(() => undefined)}
    />
  );
}
