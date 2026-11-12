'use strict';
function unauthorized() {
  return Object.assign(new Error('Unauthorized together session'), {
    status: 401,
    code: 'UNAUTHORIZED',
  });
}
class TogetherBridge {
  constructor({ store, upstream, validate, onRevoke = () => {} }) {
    if (typeof validate !== 'function')
      throw new Error('Site session validator is required');
    this.store = store;
    this.upstream = upstream;
    this.validate = validate;
    this.onRevoke = onRevoke;
    this.flights = new Map();
  }
  async active(principal) {
    const fresh = await this.validate(principal);
    if (
      !fresh ||
      !fresh.accountId ||
      !fresh.incarnation ||
      !fresh.sessionId ||
      fresh.banned ||
      fresh.accountId !== principal.accountId ||
      fresh.incarnation !== principal.incarnation ||
      fresh.sessionId !== principal.sessionId ||
      !Number.isFinite(fresh.expiresAt) ||
      fresh.expiresAt <= Date.now()
    )
      throw unauthorized();
    return fresh;
  }
  async once(key, action) {
    if (this.flights.has(key)) return this.flights.get(key);
    const pending = Promise.resolve().then(action);
    this.flights.set(key, pending);
    try {
      return await pending;
    } finally {
      if (this.flights.get(key) === pending) this.flights.delete(key);
    }
  }
  async ensure(principal) {
    const fresh = await this.active(principal);
    const identity = this.store.identity(fresh.accountId, fresh.incarnation);
    if (!identity.upstreamUserId)
      await this.once('identity:' + identity.id, async () => {
        const current = this.store.identity(fresh.accountId, fresh.incarnation);
        if (current.id !== identity.id) throw unauthorized();
        if (current.upstreamUserId) return;
        let user;
        try {
          user = await this.upstream.createUser(current);
        } catch (error) {
          if (error.status !== 409) throw error;
          const credentials = await this.upstream.login(
            current.username,
            current.password
          );
          try {
            user = { id: credentials.userId };
          } finally {
            await this.cleanup(credentials);
          }
        }
        await this.active(principal);
        this.store.bindUser(identity.id, user.id);
      });
    return {
      principal: fresh,
      identity: this.store.identity(fresh.accountId, fresh.incarnation),
    };
  }
  async session(principal) {
    const { principal: fresh, identity } = await this.ensure(principal);
    return this.once(
      'session:' + identity.id + ':' + fresh.sessionId,
      async () => {
        await this.active(principal);
        const existing = this.store.session(identity.id, fresh.sessionId);
        if (existing) return { identity, ...existing };
        const credentials = await this.upstream.login(
          identity.username,
          identity.password
        );
        try {
          await this.active(principal);
          const saved = this.store.saveSession(
            identity.id,
            fresh.sessionId,
            credentials,
            fresh.expiresAt
          );
          if (!saved) throw unauthorized();
          return { identity, ...saved };
        } catch (error) {
          await this.cleanup(credentials);
          throw error;
        }
      }
    );
  }
  async describe(principal) {
    const session = await this.session(principal);
    return {
      identityId: session.identity.id,
      upstreamUserId: session.identity.upstreamUserId,
      displayName: principal.accountId,
    };
  }
  async request(principal, method, path, body) {
    let session = await this.session(principal);
    await this.active(principal);
    try {
      const result = await this.upstream.request(
        method,
        path,
        body,
        session.credentials.accessToken
      );
      await this.active(principal);
      return result;
    } catch (error) {
      if (error.status !== 401) throw error;
      session = await this.once('refresh:' + session.id, async () => {
        const current = this.store.session(
          session.identity.id,
          principal.sessionId
        );
        if (!current) throw unauthorized();
        if (current.credentials.accessToken !== session.credentials.accessToken)
          return { ...current, identity: session.identity };
        const credentials = {
          ...current.credentials,
          ...(await this.upstream.refresh(current.credentials)),
        };
        try {
          await this.active(principal);
          const saved = this.store.saveSession(
            session.identity.id,
            principal.sessionId,
            credentials,
            principal.expiresAt
          );
          if (!saved) throw unauthorized();
          return { ...saved, identity: session.identity };
        } catch (error) {
          await this.cleanup(credentials);
          throw error;
        }
      });
      await this.active(principal);
      const result = await this.upstream.request(
        method,
        path,
        body,
        session.credentials.accessToken
      );
      await this.active(principal);
      return result;
    }
  }
  revokeSession(accountId, sessionId) {
    this.store.revokeSession(accountId, sessionId);
    this.onRevoke(accountId, sessionId);
  }
  revokeAccount(accountId) {
    this.store.revokeAccount(accountId);
    this.onRevoke(accountId);
  }
  async cleanup(credentials) {
    try {
      await this.upstream.logout(credentials);
    } catch (error) {
      if (error.status !== 401) this.store.queueRevocation(credentials);
    }
  }
  revokeAccountSessions(accountId) {
    this.store.revokeAccountSessions(accountId);
    this.onRevoke(accountId);
  }
  async flushRevocations() {
    for (const row of this.store.pendingRevocations()) {
      try {
        await this.upstream.logout(row.credentials);
        this.store.completeRevocation(row.id);
      } catch (error) {
        if (error.status === 401) this.store.completeRevocation(row.id);
      }
    }
  }
}
module.exports = { TogetherBridge };
