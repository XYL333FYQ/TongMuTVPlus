/**
 * 全站唯一写日志的地方（服务器、浏览器都用）。其他文件不直接调 console，
 * 以后要统一加前缀、采样或上报，只改这里。级别和原来的 console 方法一一对应：
 * info 对应原来的 console.log，照样输出。
 *
 * ESLint 的 no-console 是为了把别处的输出都引到这里；.eslintrc.js 只给这个文件关掉它。
 * 调用时再取 console 的方法，测试里替换 console 方法照样生效。
 */
type LogArgs = unknown[];

export const logger = {
  debug: (...args: LogArgs) => console.debug(...args),
  info: (...args: LogArgs) => console.log(...args),
  warn: (...args: LogArgs) => console.warn(...args),
  error: (...args: LogArgs) => console.error(...args),
};
