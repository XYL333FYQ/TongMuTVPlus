import type { NextRequest } from 'next/server';

import { getAvailableApiSites } from '@/lib/config';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/request-auth';

type ProxyAuthorization = {
  kind: 'session' | 'proxy-token' | 'tvbox-token';
  tokenParam: string;
};

/** Node-only bridge for external clients: a valid session or an explicitly configured token. */
export async function authorizeMediaProxy(
  request: NextRequest,
  cmsApi?: string
): Promise<ProxyAuthorization | null> {
  if (await authenticateRequest(request))
    return { kind: 'session', tokenParam: '' };
  const params = request.nextUrl.searchParams;
  const legacyToken = params.get('token');
  // New deployments use a server-only name; retain the old name solely for external-client compatibility.
  const expectedProxyToken =
    process.env.PROXY_M3U8_TOKEN || process.env.NEXT_PUBLIC_PROXY_M3U8_TOKEN;
  if (expectedProxyToken?.trim() && legacyToken === expectedProxyToken) {
    return {
      kind: 'proxy-token',
      tokenParam: `&token=${encodeURIComponent(legacyToken)}`,
    };
  }
  const token = params.get('tvboxToken');
  if (!token || process.env.ENABLE_TVBOX_SUBSCRIBE !== 'true') return null;
  let username: string | undefined;
  const globalToken = process.env.TVBOX_SUBSCRIBE_TOKEN;
  if (!globalToken || token !== globalToken) {
    username = (await db.getUsernameByTvboxToken(token)) || undefined;
    if (!username) return null;
    const user = await db.getUserInfoV2(username);
    if (!user || user.banned) return null;
  }
  if (cmsApi) {
    const sites = await getAvailableApiSites(username);
    if (!sites.some((site) => site.api === cmsApi)) return null;
  }
  return {
    kind: 'tvbox-token',
    tokenParam: `&tvboxToken=${encodeURIComponent(token)}`,
  };
}
