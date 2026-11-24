/**
 * 全站唯一写日志的地方（服务器、浏览器都用）。其他文件不直接调 console，
 * 以后要统一加前缀、采样或上报，只改这里。级别和原来的 console 方法一一对应：
 * info 对应原来的 console.log，照样输出。
 *
 * ESLint 的 no-console 是为了把别处的输出都引到这里；这里是控制台的主人，
 * 从 globalThis 取控制台，调用时再取方法（测试里替换 console 方法照样生效）。
 */
type LogArgs = unknown[];

const sink = (): Console => globalThis.console;

export const logger = {
  debug: (...args: LogArgs) => sink().debug(...args),
  info: (...args: LogArgs) => sink().log(...args),
  warn: (...args: LogArgs) => sink().warn(...args),
  error: (...args: LogArgs) => sink().error(...args),
};
