// 用户密码哈希。
//
// 旧版直接存 SHA-256(密码) 的十六进制：没有盐、计算极快，数据库一旦泄露，
// 常见密码几秒内就能被彩虹表或显卡反查出来。
// 新版用 PBKDF2-SHA256 + 每个用户独立的随机盐，存成
//   pbkdf2$sha256$<迭代次数>$<盐 base64>$<哈希 base64>
// 只用 WebCrypto，Node、Edge 中间件、Cloudflare Workers 都能跑
// （Workers 的 PBKDF2 上限是 10 万次迭代，所以取 100000）。
//
// 旧哈希仍能验证；验证通过时 needsRehash=true，调用方顺手换成新格式，
// 用户无感升级，不需要统一重置密码。

const ALGORITHM = 'pbkdf2';
const DIGEST = 'sha256';
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;
const LEGACY_SHA256 = /^[0-9a-f]{64}$/i;

export interface PasswordCheck {
  ok: boolean;
  // 验证通过但仍是旧格式（或迭代次数偏低），应改存为新哈希
  needsRehash: boolean;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// 定长比较，避免按字节提前返回泄露匹配进度
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    KEY_BITS
  );
  return new Uint8Array(bits);
}

async function legacySha256(password: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(password)
  );
  return new Uint8Array(digest);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return [ALGORITHM, DIGEST, ITERATIONS, toBase64(salt), toBase64(hash)].join(
    '$'
  );
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined
): Promise<PasswordCheck> {
  const fail = { ok: false, needsRehash: false };
  if (!stored) return fail;

  if (LEGACY_SHA256.test(stored)) {
    const ok = sameBytes(await legacySha256(password), hexToBytes(stored));
    return { ok, needsRehash: ok };
  }

  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== ALGORITHM || parts[1] !== DIGEST) {
    return fail;
  }
  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 1) return fail;
  try {
    const salt = fromBase64(parts[3]);
    const expected = fromBase64(parts[4]);
    const actual = await derive(password, salt, iterations);
    const ok = sameBytes(actual, expected);
    return { ok, needsRehash: ok && iterations < ITERATIONS };
  } catch {
    return fail;
  }
}
