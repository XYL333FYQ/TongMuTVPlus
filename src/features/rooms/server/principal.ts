import type { NextRequest } from 'next/server';
import 'server-only';

import { db } from '@/lib/db';
import { verifyRefreshToken } from '@/lib/refresh-token';
import { authenticateRequest } from '@/lib/request-auth';

import { createPrincipalResolver } from '../../../../server/together/principal.cjs';

export async function resolveTogetherPrincipal(request: NextRequest) {
  return createPrincipalResolver({
    authenticate: () => authenticateRequest(request),
    getUser: (username: string) => db.getUserInfoV2(username),
    verifySession: verifyRefreshToken,
    ownerUsername: process.env.USERNAME,
  })();
}
