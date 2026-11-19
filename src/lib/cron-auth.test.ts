/** @jest-environment node */
import { checkCronAuth } from './cron-auth';

describe('checkCronAuth', () => {
  it('is disabled when neither CRON_PASSWORD nor CRON_SECRET is set', () => {
    expect(checkCronAuth('anything', null, {})).toBe('disabled');
  });

  it('accepts the password in the path', () => {
    const env = { CRON_PASSWORD: 'p4ss' };
    expect(checkCronAuth('p4ss', null, env)).toBe('ok');
    expect(checkCronAuth('wrong', null, env)).toBe('unauthorized');
  });

  it('accepts the Vercel cron bearer header whatever the path says', () => {
    const env = { CRON_SECRET: 's3cret' };
    expect(checkCronAuth('vercel', 'Bearer s3cret', env)).toBe('ok');
    expect(checkCronAuth('vercel', 'Bearer nope', env)).toBe('unauthorized');
    expect(checkCronAuth('vercel', null, env)).toBe('unauthorized');
  });
});
