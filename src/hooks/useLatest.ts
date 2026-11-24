import { useRef } from 'react';

/**
 * 在 effect、回调里读到最新的值，又不让它成为依赖：effect 还是按原来的依赖触发，
 * 但调用的总是这一次渲染的函数 / 状态。返回的 ref 本身不会变，放进依赖数组也不会多触发。
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
