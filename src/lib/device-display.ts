/** 只转换设备名称的展示，不改动登录记录或客户端识别协议。 */
export function getDeviceDisplayName(deviceInfo: string): string {
  return /^moon\s?tv(?:\s?plus)?(?:\s+app)?$/i.test(deviceInfo.trim())
    ? '兼容客户端'
    : deviceInfo;
}
