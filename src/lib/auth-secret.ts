// 登录 Cookie 的签名密钥。
//
// 以前直接用站长密码 PASSWORD 做 HMAC 密钥：任何成员拿着自己 Cookie 里的
// {username, role, timestamp} 和签名，就能离线暴力破解出站长密码。
// 现在优先使用独立的高强度 AUTH_SECRET（server.js 启动时若未配置会自动生成并保存在数据目录），
// 只有拿不到它的平台（如边缘部署）才回退到 PASSWORD，保持兼容。
//
// 只读环境变量，Edge 中间件与 Node 路由都能调用。
export function getAuthSigningSecret(): string {
  return process.env.AUTH_SECRET || process.env.PASSWORD || '';
}
