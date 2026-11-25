/**
 * 测试里换掉浏览器有、jsdom 没有（或要替身）的全局对象，例如 RTCPeerConnection、AudioContext。
 * 用 defineProperty 而不是强转类型去赋值，类型检查和 lint 都不用开例外。
 */
export function setGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}
