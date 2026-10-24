import dns from 'dns';

/**
 * 判断 IP 地址是否为内网/本地私有地址
 * 覆盖 IPv4 和 IPv6，彻底杜绝所有变体绕过。
 */
export function isPrivateIP(ip: string): boolean {
  if (ip.includes(':')) {
    try {
      ip = new URL(`http://[${ip}]`).hostname.slice(1, -1);
      const mapped = /^::ffff:([\da-f]+):([\da-f]+)$/i.exec(ip);
      if (mapped) {
        const high = parseInt(mapped[1], 16);
        const low = parseInt(mapped[2], 16);
        ip = `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
      }
    } catch {
      return false;
    }
  }

  // IPv4 私有地址和环回地址
  if (ip.includes('.')) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;

    return (
      parts[0] === 10 || // 10.x.x.x
      parts[0] === 127 || // 127.x.x.x (Loopback)
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.x.x - 172.31.x.x
      (parts[0] === 192 && parts[1] === 168) || // 192.168.x.x
      (parts[0] === 169 && parts[1] === 254) || // 169.254.x.x (Link-local)
      parts[0] === 0 || // 0.x.x.x ("This network")
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) || // 100.64.0.0/10 运营商级 NAT
      (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) || // 198.18.0.0/15 基准测试网段
      parts[0] >= 224 // 224.0.0.0 以上：组播与保留地址
    );
  }

  // IPv6 私有地址和环回地址
  if (ip.includes(':')) {
    // ::1 环回地址 (Loopback)
    if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;

    // 0::0 / :: 未指定地址
    if (ip === '::' || ip === '0:0:0:0:0:0:0:0') return true;

    const lowerIp = ip.toLowerCase();

    // 唯一本地地址 (Unique Local Addresses, fc00::/7)
    if (lowerIp.startsWith('fc') || lowerIp.startsWith('fd')) return true;

    // 链路本地地址 (Link-Local Addresses, fe80::/10)
    if (
      lowerIp.startsWith('fe8') ||
      lowerIp.startsWith('fe9') ||
      lowerIp.startsWith('fea') ||
      lowerIp.startsWith('feb')
    )
      return true;
  }

  return false;
}

/**
 * 校验代理 URL 是否安全 (防止 SSRF / DNS 重绑定漏洞)
 * 只在 Node.js 服务端运行。
 */
export async function validateProxyUrlServerSide(
  urlStr: string
): Promise<boolean> {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr);

    // 1. 协议检查
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    // 2. 剥离认证信息防止混淆
    if (parsed.username || parsed.password) {
      return false;
    }

    let { hostname } = parsed;

    // 清洗 IPv6 括号边界
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.substring(1, hostname.length - 1);
    }

    // 3. DNS 真实解析 (获取底层物理 IP)
    // 这一步能彻底打碎各种形式的短格式 IP (127.1)、八/十六进制 IP (0x7f.0.0.1)、或者指向 127.0.0.1 的恶意外部域名 DNS 重绑定。
    const lookupResult = await dns.promises.lookup(hostname);

    if (!lookupResult || !lookupResult.address) {
      return false; // 解析不出 IP 则拒绝
    }

    // 4. 对物理 IP 进行内网校验
    if (isPrivateIP(lookupResult.address)) {
      console.warn(
        `[SSRF 防护] 拦截到尝试访问内部网络的请求 URL: ${urlStr} (解析出的底层 IP: ${lookupResult.address})`
      );
      return false;
    }

    return true;
  } catch (error) {
    // 凡是报错（无论是 URL 解析失败，还是 DNS 解析失败，还是域名不存在），均作为不安全拒绝
    console.warn(`[SSRF 防护] URL解析失败或不合法, 拒绝代理请求: ${urlStr}`);
    return false;
  }
}

/**
 * 站长明确允许代理访问内网（例如局域网 IPTV / Emby）时打开：ALLOW_PRIVATE_PROXY_TARGETS=true。
 * 默认关闭：普通成员不能借代理接口探测服务器所在内网。
 */
export function privateProxyTargetsAllowed(): boolean {
  return process.env.ALLOW_PRIVATE_PROXY_TARGETS === 'true';
}

/** 从站长配置的地址里取出主机名，作为“可信内网主机”白名单 */
export function hostsOf(urls: Array<string | undefined | null>): Set<string> {
  const hosts = new Set<string>();
  for (const url of urls) {
    if (!url) continue;
    try {
      hosts.add(new URL(url).hostname.toLowerCase());
    } catch {
      // 配置里的非法地址直接忽略
    }
  }
  return hosts;
}

/**
 * 代理目标是否允许访问：
 * - 只允许 http/https；
 * - 站长配置过的主机（trustedHosts）即使在内网也放行；
 * - 其他地址必须解析到公网 IP，除非站长打开了 ALLOW_PRIVATE_PROXY_TARGETS。
 */
export async function isProxyTargetAllowed(
  urlStr: string,
  trustedHosts?: Set<string>
): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (privateProxyTargetsAllowed()) return true;
  if (trustedHosts?.has(parsed.hostname.toLowerCase())) return true;
  return validateProxyUrlServerSide(urlStr);
}

export class ProxyTargetBlockedError extends Error {
  constructor(public readonly target: string) {
    super('Proxy request to local or invalid network is forbidden');
    this.name = 'ProxyTargetBlockedError';
  }
}

/**
 * 带 SSRF 防护的 fetch：手动跟随重定向，每一跳都重新校验目标，
 * 防止“先访问公网地址、再 302 到 127.0.0.1”绕过检查。
 * 返回的 Response.url 是最后一跳的地址，可直接用于解析 m3u8 相对路径。
 */
export async function guardedFetch(
  urlStr: string,
  init: RequestInit = {},
  options: { trustedHosts?: Set<string>; maxRedirects?: number } = {}
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 5;
  let current = urlStr;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!(await isProxyTargetAllowed(current, options.trustedHosts))) {
      throw new ProxyTargetBlockedError(current);
    }
    const response = await fetch(current, { ...init, redirect: 'manual' });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      try {
        await response.body?.cancel();
      } catch {
        // 丢弃重定向响应体失败不影响继续
      }
      current = new URL(location, current).toString();
      continue;
    }
    return response;
  }
  throw new ProxyTargetBlockedError(current);
}

/**
 * 代理图片时只透传 image/* 类型；其他类型（如 text/html）一律改成二进制，
 * 浏览器 <img> 仍能显示，但不会被当作网页执行。
 */
export function safeImageContentType(contentType: string | null): string {
  const value = (contentType || '').trim();
  return /^image\/[\w.+-]+/i.test(value) ? value : 'application/octet-stream';
}

/** 代理媒体流时只透传音视频 / 播放列表类型，其余改为二进制 */
export function safeMediaContentType(contentType: string | null): string {
  const value = (contentType || '').trim();
  return /^(video|audio)\/|mpegurl|^application\/(octet-stream|dash\+xml|mp4)/i.test(
    value
  )
    ? value
    : 'application/octet-stream';
}
