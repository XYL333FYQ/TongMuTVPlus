/**
 * Turso (libSQL) 适配器
 *
 * 将 @libsql/client API 转换为与 D1 兼容的接口
 * Turso 基于 libSQL（SQLite 开源分支），SQL 语法与 D1/SQLite 完全兼容
 *
 * 适用于 EdgeOne Pages 等无内置数据库的边缘平台
 *
 * 注意：此模块仅在服务端使用，通过 webpack 配置排除客户端打包
 */

import type { Client, InStatement, InValue } from '@libsql/client/http';

import { logger } from '@/lib/logger';

import {
  D1PreparedStatement,
  D1Result,
  DatabaseAdapter,
  DbRow,
} from './d1-adapter';

type CreateClient = typeof import('@libsql/client/http').createClient;

/**
 * 动态加载 @libsql/client 的 createClient 函数
 *
 * 使用 require 而非 import，避免 webpack 在 EdgeOne 构建中
 * 因条件导出 (edge-light) 错误解析 ESM 模块（.eslintrc.js 里给这个文件开了 require 的例外）
 *
 * 使用 @libsql/client/http 子路径而非主入口，避免拉入原生 libsql
 * 模块和 isomorphic-ws/isomorphic-fetch 等不兼容边缘环境的依赖
 */
function getLibsqlClient(): CreateClient {
  const mod = require('@libsql/client/http') as {
    createClient?: CreateClient;
    default?: { createClient?: CreateClient };
  };
  return (mod.createClient || mod.default?.createClient) as CreateClient;
}

/**
 * Turso 适配器
 *
 * 使用 @libsql/client 包装为 D1 兼容接口
 */
export class TursoAdapter implements DatabaseAdapter {
  private client: Client;

  constructor(url: string, authToken: string) {
    const createClient = getLibsqlClient();
    this.client = createClient({
      url,
      authToken,
    });
  }

  prepare(query: string): D1PreparedStatement {
    return new TursoPreparedStatement(this.client, query);
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    // Turso/libSQL 原生支持 batch
    const libsqlStatements = statements.map((stmt) =>
      (stmt as TursoPreparedStatement).toLibSQLBatch()
    );
    const results = await this.client.batch(libsqlStatements, 'write');
    return results.map((result) => ({
      success: true,
      results: (result.rows || []) as unknown as DbRow[],
      meta: {
        changes: result.rowsAffected,
        last_row_id:
          result.lastInsertRowid !== undefined
            ? Number(result.lastInsertRowid)
            : null,
      },
    }));
  }

  async exec(query: string): Promise<void> {
    await this.client.executeMultiple(query);
  }
}

/**
 * Turso PreparedStatement 包装器
 * 将 @libsql/client API 转换为 D1 兼容 API
 */
class TursoPreparedStatement implements D1PreparedStatement {
  private params: InValue[] = [];

  constructor(private client: Client, private query: string) {}

  bind(...values: unknown[]): D1PreparedStatement {
    // 绑定的值由调用方保证是 SQL 能存的类型（字符串、数字、null 等）
    this.params = values as InValue[];
    return this;
  }

  /**
   * 执行查询并返回第一行
   */
  async first<T = DbRow>(colName?: string): Promise<T | null> {
    try {
      const result = await this.client.execute({
        sql: this.query,
        args: this.params,
      });

      if (!result.rows || result.rows.length === 0) return null;

      const row = result.rows[0] as unknown as DbRow;
      if (colName) return (row[colName] ?? null) as T | null;

      return row as T;
    } catch (err) {
      logger.error('Turso first() error:', err);
      return null;
    }
  }

  /**
   * 执行查询并返回结果
   */
  async run<T = DbRow>(): Promise<D1Result<T>> {
    try {
      const result = await this.client.execute({
        sql: this.query,
        args: this.params,
      });

      return {
        success: true,
        meta: {
          changes: result.rowsAffected,
          last_row_id:
            result.lastInsertRowid !== undefined
              ? Number(result.lastInsertRowid)
              : null,
        },
        results: result.rows as unknown as T[],
      };
    } catch (err) {
      logger.error('Turso run() error:', err);
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  }

  /**
   * 执行查询并返回所有行
   */
  async all<T = DbRow>(): Promise<D1Result<T>> {
    try {
      const result = await this.client.execute({
        sql: this.query,
        args: this.params,
      });

      return {
        success: true,
        results: (result.rows || []) as unknown as T[],
      };
    } catch (err) {
      logger.error('Turso all() error:', err);
      return {
        success: false,
        error: (err as Error).message,
        results: [],
      };
    }
  }

  /**
   * 转换为 libSQL batch 格式
   */
  toLibSQLBatch(): InStatement {
    return { sql: this.query, args: this.params };
  }
}
