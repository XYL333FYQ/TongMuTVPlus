/**
 * 外部观影室服务的边界。
 * 使用外部服务时，实时房间走外部 Socket；本站不挂载房间 REST（/api/rooms 返回 503），
 * 所以房间目录和长期房间恢复只有内置服务才有。这里统一说清楚，
 * 不再去请求一个已知会失败的接口，也不显示笼统的“房间服务暂时不可用”。
 * 外部服务是否兼容本站的房间协议，本站无法验证，不做假设。
 */
export const EXTERNAL_ROOM_SERVER_NOTICE =
  '当前使用外部观影室服务，房间目录和长期房间恢复仅内置服务提供';

export function isExternalRoomServer(
  config: { serverType?: string } | null | undefined
) {
  return config?.serverType === 'external';
}
