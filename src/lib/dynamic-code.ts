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

/** 计算一段表达式的值（等同于把它包在 return 里运行） */
export function evaluateExpression(expression: string): unknown {
  return compileFunction([], `return (${expression});`)();
}
