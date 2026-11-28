/**
 * 进程里只建一次的对象（数据库连接、用户缓存、锁）。
 * 开发时热更新会重新执行模块，挂在 globalThis 上、用 Symbol.for 的键取回同一个，避免反复建连接。
 * 第一次取时调用 create，以后都返回同一个。
 */
const store = globalThis as unknown as Record<symbol, unknown>;

export function processSingleton<T>(key: symbol, create: () => T): T {
  if (!store[key]) store[key] = create();
  return store[key] as T;
}
