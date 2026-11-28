import { StandardRedisAdapter } from './redis-adapter';
import { BaseRedisStorage } from './redis-base.db';
import { createRedisClient, createRetryWrapper } from './redis-node-client';

export class RedisStorage extends BaseRedisStorage {
  constructor() {
    const config = {
      // 没配时是空字符串，createRedisClient 会报“REDIS_URL 没设置”
      url: process.env.REDIS_URL ?? '',
      clientName: 'Redis',
    };
    const globalSymbol = Symbol.for('__MOONTV_REDIS_CLIENT__');
    const client = createRedisClient(config, globalSymbol);
    const adapter = new StandardRedisAdapter(client);
    const withRetry = createRetryWrapper(config.clientName, () => client);
    super(adapter, withRetry);
  }
}
