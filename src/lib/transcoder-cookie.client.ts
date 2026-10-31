// 交给本机转码程序的 Cookie：页面上脚本可读的 Cookie + 一份短效登录凭证。
// 登录凭证本身脚本读不到，由 /api/auth/transcoder-cookie 发短效副本（见该接口说明）。
export async function getTranscoderCookieHeader(): Promise<string> {
  const readable = document.cookie
    .split(';')
    .map((part) => part.trim())
    // 旧写法的可读凭证不再直接转出，统一用短效副本
    .filter((part) => part && !part.startsWith('auth='));
  try {
    const response = await fetch('/api/auth/transcoder-cookie', {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (response.ok) {
      const data = (await response.json()) as { cookie?: string };
      if (data.cookie) readable.push(data.cookie);
    }
  } catch {
    // 拿不到就只带可读部分，与未登录时一样
  }
  return readable.join('; ');
}
