/**
 * 全站唯一把字符串当代码运行的地方：站长在后台配的音源表达式、去广告函数、书源规则。
 * 这些代码来自站长配置，不是访客输入；别处不直接写 eval / new Function。
 */
export function compileFunction(
  params: string[],
  body: string
): (...args: unknown[]) => unknown {
  return new Function(...params, body) as (...args: unknown[]) => unknown;
}

/**
 * 计算一段代码的值，和原来的 eval 一样：可以是几条语句，取最后一条的值。
 * 用间接 eval（全局作用域），代码碰不到调用处的局部变量。
 */
export function evaluateExpression(code: string): unknown {
  const globalEval = globalThis.eval;
  return globalEval(code);
}
