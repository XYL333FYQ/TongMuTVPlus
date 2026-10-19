import { NextRequest } from 'next/server';

import { authenticateRequest } from './request-auth';

/**
 * Website proxy URLs use the existing session-only marker, never an administrator or user TVBox token.
 * External TVBox routes receive their own authorized path token independently.
 */
export async function getProxyToken(
  request?: NextRequest
): Promise<string | null> {
  if (!request) return null;
  const auth = await authenticateRequest(request);
  return auth?.username ? 'proxy' : null;
}
