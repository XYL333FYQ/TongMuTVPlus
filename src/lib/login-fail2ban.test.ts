/** @jest-environment ./src/test/node-web-environment.cjs */
import { NextRequest } from 'next/server';

import {
  checkAccountLock,
  checkLoginBan,
  formatRetryWait,
  getLoginClientIp,
  recordAccountFailure,
  recordAccountSuccess,
  recordLoginFailure,
} from './login-fail2ban';

function requestWith(headers: Record<string, string>) {
  return new NextRequest('http://localhost/api/login', { headers });
}

beforeEach(() => {
  delete (globalThis as { __loginFail2BanStore?: unknown })
    .__loginFail2BanStore;
  delete process.env.TRUST_CF_CONNECTING_IP;
  delete (globalThis as { __loginAccountLocks?: unknown }).__loginAccountLocks;
  delete (globalThis as { __loginTrustedIps?: unknown }).__loginTrustedIps;
});

test('ten wrong passwords for one account lock it for 15 minutes regardless of IP', () => {
  const start = 1_000_000;
  for (let i = 0; i < 9; i++) recordAccountFailure('Admin', start + i);
  expect(checkAccountLock('admin', start + 10).banned).toBe(false);

  recordAccountFailure('admin', start + 20);
  const locked = checkAccountLock('ADMIN', start + 30);
  expect(locked.banned).toBe(true);
  expect(locked.retryAfterSeconds).toBe(15 * 60);

  expect(checkAccountLock('admin', start + 20 + 15 * 60 * 1000).banned).toBe(
    false
  );
});

test('failures outside the 15 minute window do not add up, and success clears the count', () => {
  const start = 2_000_000;
  for (let i = 0; i < 9; i++) recordAccountFailure('alice', start);
  recordAccountFailure('alice', start + 16 * 60 * 1000);
  expect(checkAccountLock('alice', start + 16 * 60 * 1000).banned).toBe(false);

  for (let i = 0; i < 9; i++) recordAccountFailure('bob', start);
  recordAccountSuccess('bob');
  recordAccountFailure('bob', start + 1);
  expect(checkAccountLock('bob', start + 2).banned).toBe(false);
});

test('missing or non-string usernames are ignored', () => {
  recordAccountFailure(undefined);
  recordAccountFailure({ name: 'x' });
  expect(checkAccountLock('').banned).toBe(false);
});

test('a locked account still lets in IPs that logged in to it before', () => {
  const start = 3_000_000;
  recordAccountSuccess('owner', '203.0.113.7', start);
  for (let i = 0; i < 10; i++) recordAccountFailure('owner', start + 1 + i);

  expect(checkAccountLock('owner', start + 20, '198.51.100.9').banned).toBe(
    true
  );
  expect(checkAccountLock('owner', start + 20).banned).toBe(true);
  expect(checkAccountLock('owner', start + 20, '203.0.113.7').banned).toBe(
    false
  );
});

test('trust expires after 30 days and only the latest five IPs are kept', () => {
  const start = 4_000_000;
  for (let i = 1; i <= 6; i++)
    recordAccountSuccess('eve', `10.0.0.${i}`, start);
  for (let i = 0; i < 10; i++) recordAccountFailure('eve', start + 1 + i);
  expect(checkAccountLock('eve', start + 20, '10.0.0.1').banned).toBe(true);
  expect(checkAccountLock('eve', start + 20, '10.0.0.6').banned).toBe(false);

  const later = start + 31 * 24 * 60 * 60 * 1000;
  for (let i = 0; i < 10; i++) recordAccountFailure('eve', later + i);
  expect(checkAccountLock('eve', later + 20, '10.0.0.6').banned).toBe(true);
});

test('five failures from one IP ban it for a flat 15 minutes, and a repeat is not longer', () => {
  const start = 5_000_000;
  const ip = '198.51.100.20';
  for (let i = 0; i < 4; i++) {
    expect(recordLoginFailure(ip, start + i).banned).toBe(false);
  }
  const banned = recordLoginFailure(ip, start + 5);
  expect(banned.banned).toBe(true);
  expect(banned.retryAfterSeconds).toBe(15 * 60);
  expect(checkLoginBan(ip, start + 5 + 60_000).retryAfterSeconds).toBe(14 * 60);

  const later = start + 20 * 60 * 1000;
  expect(checkLoginBan(ip, later).banned).toBe(false);
  for (let i = 0; i < 4; i++) recordLoginFailure(ip, later + i);
  const again = recordLoginFailure(ip, later + 5);
  expect(again.retryAfterSeconds).toBe(15 * 60);
});

test('another IP is not affected by a banned one', () => {
  const start = 6_000_000;
  for (let i = 0; i < 5; i++) recordLoginFailure('198.51.100.21', start + i);
  expect(checkLoginBan('198.51.100.21', start + 10).banned).toBe(true);
  expect(checkLoginBan('198.51.100.22', start + 10).banned).toBe(false);
});

test('the client IP comes from what the reverse proxy wrote, not from headers anyone can forge', () => {
  expect(
    getLoginClientIp(
      requestWith({
        'x-real-ip': '203.0.113.5',
        'cf-connecting-ip': '1.1.1.1',
        'x-forwarded-for': '2.2.2.2, 203.0.113.5',
      })
    )
  ).toBe('203.0.113.5');
  // 没有 X-Real-IP 时用 X-Forwarded-For 的最后一段（代理追加的），第一段是客户端能伪造的
  expect(
    getLoginClientIp(requestWith({ 'x-forwarded-for': '2.2.2.2, 203.0.113.9' }))
  ).toBe('203.0.113.9');
  expect(getLoginClientIp(requestWith({ 'cf-connecting-ip': '1.1.1.1' }))).toBe(
    null
  );
  expect(getLoginClientIp(requestWith({}))).toBe(null);
});

test('CF-Connecting-IP is honoured only when the site is declared to be behind Cloudflare', () => {
  process.env.TRUST_CF_CONNECTING_IP = 'true';
  expect(
    getLoginClientIp(
      requestWith({ 'cf-connecting-ip': '1.1.1.1', 'x-real-ip': '10.0.0.1' })
    )
  ).toBe('1.1.1.1');
});

test('the remaining wait is spoken in seconds under a minute, otherwise rounded up to minutes', () => {
  expect(formatRetryWait(42)).toBe('42 秒');
  expect(formatRetryWait(60)).toBe('1 分钟');
  expect(formatRetryWait(61)).toBe('2 分钟');
  expect(formatRetryWait(15 * 60)).toBe('15 分钟');
  expect(formatRetryWait(undefined)).toBe('1 秒');
});
