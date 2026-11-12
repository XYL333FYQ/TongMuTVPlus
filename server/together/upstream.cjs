'use strict';
class UpstreamError extends Error {
  constructor(status, code = 'SYNCTV_ERROR', retryAfterMs = 0) {
    super(
      status >= 500 ? 'SyncTV service unavailable' : 'SyncTV request rejected'
    );
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}
class SyncTvUpstream {
  constructor({
    baseUrl,
    adminUsername,
    adminPassword,
    fetch = globalThis.fetch,
    sleep = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  }) {
    const base = new URL(baseUrl);
    if (
      !['http:', 'https:'].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.pathname !== '/' ||
      base.search ||
      base.hash
    )
      throw new Error('Invalid SyncTV service URL');
    if (!adminUsername || !adminPassword)
      throw new Error('SyncTV bootstrap credentials required');
    this.base = base;
    this.adminUsername = adminUsername;
    this.adminPassword = adminPassword;
    this.fetch = fetch;
    this.sleep = sleep;
    this.loginChain = Promise.resolve();
    this.pendingLogins = 0;
    this.adminCredentials = null;
    this.adminFlight = null;
  }
  async request(method, path, body, accessToken) {
    if (
      typeof path !== 'string' ||
      !path.startsWith('/api/') ||
      path.includes('\\') ||
      /[\r\n\0#]/.test(path)
    )
      throw new Error('Invalid SyncTV API path');
    let decoded;
    try {
      decoded = decodeURIComponent(path.split('?')[0]);
    } catch {
      throw new Error('Invalid SyncTV API path');
    }
    if (decoded.split('/').includes('..') || decoded.includes('\\'))
      throw new Error('Invalid SyncTV API path');
    const url = new URL(path, this.base);
    if (url.origin !== this.base.origin || !url.pathname.startsWith('/api/'))
      throw new Error('Invalid SyncTV API path');
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
    let response;
    try {
      response = await this.fetch(url.href, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new UpstreamError(503, 'SYNCTV_UNAVAILABLE');
    }
    if (!response.ok) {
      const value = response.headers.get('retry-after');
      const seconds = Number(value);
      const retryAfterMs =
        response.status === 429
          ? Math.min(
              60000,
              Math.max(
                1000,
                value && Number.isFinite(seconds) ? seconds * 1000 : 1000
              )
            )
          : 0;
      await response.body?.cancel().catch(() => {});
      throw new UpstreamError(response.status, 'SYNCTV_ERROR', retryAfterMs);
    }
    try {
      if (!response.body) return {};
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 8 * 1024 * 1024) {
          await reader.cancel();
          throw new Error('Too large');
        }
        chunks.push(Buffer.from(part.value));
      }
      const text = Buffer.concat(chunks).toString('utf8');
      return text ? JSON.parse(text) : {};
    } catch {
      throw new UpstreamError(502, 'SYNCTV_INVALID_RESPONSE');
    }
  }
  async login(username, password) {
    if (this.pendingLogins >= 16)
      throw new UpstreamError(429, 'SYNCTV_BUSY', 1000);
    this.pendingLogins++;
    const deadline = Date.now() + 65000;
    const action = async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (Date.now() > deadline)
          throw new UpstreamError(429, 'SYNCTV_BUSY', 1000);
        try {
          return await this.loginNow(username, password);
        } catch (error) {
          if (
            error.status !== 429 ||
            attempt !== 0 ||
            Date.now() + error.retryAfterMs > deadline
          )
            throw error;
          await this.sleep(error.retryAfterMs);
        }
      }
    };
    const result = this.loginChain.then(action);
    this.loginChain = result.catch(() => {});
    try {
      return await result;
    } finally {
      this.pendingLogins--;
    }
  }
  async loginNow(username, password) {
    const started = await this.request('POST', '/api/auth/login/start', {
      username,
    });
    if (!started.loginSessionId)
      throw new Error('Invalid SyncTV login response');
    const response = await this.request(
      'POST',
      '/api/auth/direct-password/login',
      { loginSessionId: started.loginSessionId, password }
    );
    if (
      typeof response.accessToken !== 'string' ||
      !response.accessToken ||
      typeof response.refreshToken !== 'string' ||
      !response.refreshToken ||
      response.mfa?.required
    )
      throw new Error('Invalid SyncTV login response');
    return {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      userId: response.user?.id,
    };
  }
  async admin() {
    if (this.adminCredentials) return this.adminCredentials;
    if (!this.adminFlight)
      this.adminFlight = this.login(this.adminUsername, this.adminPassword)
        .then((value) => {
          this.adminCredentials = value;
          return value;
        })
        .finally(() => {
          this.adminFlight = null;
        });
    return this.adminFlight;
  }
  async createUser(identity) {
    const body = {
      username: identity.username,
      password: identity.password,
      role: 3,
      status: 1,
    };
    let admin = await this.admin();
    try {
      return await this.request(
        'POST',
        '/api/admin/users',
        body,
        admin.accessToken
      );
    } catch (error) {
      if (error.status !== 401) throw error;
      this.adminCredentials = null;
      admin = await this.admin();
      return this.request('POST', '/api/admin/users', body, admin.accessToken);
    }
  }
  async refresh(credentials) {
    const value = await this.request('POST', '/api/auth/refresh', {
      refreshToken: credentials.refreshToken,
    });
    if (!value.accessToken || !value.refreshToken)
      throw new Error('Invalid SyncTV refresh response');
    return { accessToken: value.accessToken, refreshToken: value.refreshToken };
  }
  async logout(credentials) {
    await this.request('POST', '/api/user/logout', {}, credentials.accessToken);
  }
}
module.exports = { SyncTvUpstream, UpstreamError };
