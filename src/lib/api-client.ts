/**
 * 界面层发网络请求的唯一入口（页面、组件、功能、hooks 都经这里，只有 lib/ 和 app/api/
 * 直接用 fetch）。现在原样转给 fetch：接口路径、请求体、状态码处理都不变；
 * 以后要统一加的东西（超时、登录过期刷新、错误上报）只改这一处。
 * 需要“登录过期自动刷新、失败抛错”的用 db.client 的 fetchWithAuth。
 */
export function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, init);
}
