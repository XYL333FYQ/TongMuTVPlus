'use strict';
function createPrincipalResolver({
  authenticate,
  getUser,
  verifySession,
  ownerUsername,
  now = Date.now,
}) {
  return async function resolve(expected) {
    const auth = await authenticate();
    if (
      !auth?.username ||
      !auth.tokenId ||
      !auth.refreshToken ||
      !Number.isFinite(auth.refreshExpires) ||
      auth.refreshExpires <= now()
    )
      return null;
    if (!['owner', 'admin', 'user'].includes(auth.role)) return null;
    let incarnation;
    if (auth.role === 'owner') {
      if (!ownerUsername || auth.username !== ownerUsername) return null;
      incarnation = 'configured-owner:' + ownerUsername;
    } else {
      if (auth.username === ownerUsername) return null;
      const user = await getUser(auth.username);
      if (
        !user ||
        user.banned ||
        user.role !== auth.role ||
        !Number.isFinite(user.created_at) ||
        user.created_at <= 0
      )
        return null;
      incarnation = 'account:' + user.created_at;
    }
    if (!(await verifySession(auth.username, auth.tokenId, auth.refreshToken)))
      return null;
    const principal = {
      accountId: auth.username,
      incarnation,
      sessionId: auth.tokenId,
      expiresAt: auth.refreshExpires,
    };
    if (
      expected &&
      (expected.accountId !== principal.accountId ||
        expected.incarnation !== incarnation ||
        expected.sessionId !== principal.sessionId)
    )
      return null;
    principal.revalidate = () => resolve(principal);
    return principal;
  };
}
module.exports = { createPrincipalResolver };
