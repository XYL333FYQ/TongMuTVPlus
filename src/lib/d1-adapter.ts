import type BetterSqlite3 from 'better-sqlite3';

import { logger } from '@/lib/logger';

/**
 * 统一的数据库适配器接口
 * 兼容 Cloudflare D1 和 better-sqlite3
 *
 * 注意：此模块仅在服务端使用，通过 webpack 配置排除客户端打包
 */

/** 查询出来的一行：列名 → 值。各张表的行类型写在用它的存储实现里，查询时用 first<行类型>() 指明 */
export type DbRow = Record<string, unknown>;

/** 执行结果附带的信息（改了几行、新插入行的 id） */
export interface D1Meta {
  changes?: number;
  last_row_id?: number | bigint | null;
  [key: string]: unknown;
}

// Cloudflare D1 Database 接口
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<D1Result>;
}

// D1 PreparedStatement 接口
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = DbRow>(colName?: string): Promise<T | null>;
  run<T = DbRow>(): Promise<D1Result<T>>;
  all<T = DbRow>(): Promise<D1Result<T>>;
}

export interface D1Result<T = DbRow> {
  results?: T[];
  success: boolean;
  meta?: D1Meta;
  error?: string;
}

// 统一的数据库接口
export interface DatabaseAdapter {
  prepare(query: string): D1PreparedStatement;
  batch?(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec?(query: string): void;
}

/**
 * Cloudflare D1 适配器（生产环境）
 */
export class CloudflareD1Adapter implements DatabaseAdapter {
  constructor(private db: D1Database) {}

  prepare(query: string): D1PreparedStatement {
    return this.db.prepare(query);
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    return this.db.batch(statements);
  }
}

/**
 * SQLite 适配器（开发环境）
 * 包装 better-sqlite3 以兼容 D1 API
 */
export class SQLiteAdapter implements DatabaseAdapter {
  private db: BetterSqlite3.Database;

  constructor(db: BetterSqlite3.Database) {
    this.db = db;
  }

  prepare(query: string): D1PreparedStatement {
    const stmt = this.db.prepare(query);
    return new SQLitePreparedStatement(stmt);
  }

  batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    // SQLite 使用事务模拟 batch
    return new Promise((resolve, reject) => {
      try {
        const results: D1Result[] = [];
        const transaction = this.db.transaction(() => {
          for (const stmt of statements) {
            const result = (stmt as SQLitePreparedStatement).runSync();
            results.push(result);
          }
        });
        transaction();
        resolve(results);
      } catch (err) {
        reject(err);
      }
    });
  }

  exec(query: string): void {
    this.db.exec(query);
  }
}

/**
 * SQLite PreparedStatement 包装器
 * 将 better-sqlite3 API 转换为 D1 兼容 API
 */
class SQLitePreparedStatement implements D1PreparedStatement {
  private stmt: BetterSqlite3.Statement;
  private params: unknown[] = [];

  constructor(stmt: BetterSqlite3.Statement) {
    this.stmt = stmt;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    this.params = values;
    return this;
  }

  async first<T = DbRow>(colName?: string): Promise<T | null> {
    try {
      const result = this.stmt.get(...this.params) as DbRow | undefined;
      if (!result) return null;
      if (colName) return (result[colName] ?? null) as T | null;
      return result as T;
    } catch (err) {
      logger.error('SQLite first() error:', err);
      return null;
    }
  }

  async run<T = DbRow>(): Promise<D1Result<T>> {
    try {
      const info = this.stmt.run(...this.params);
      return {
        success: true,
        meta: {
          changes: info.changes,
          last_row_id: info.lastInsertRowid,
        },
      };
    } catch (err) {
      logger.error('SQLite run() error:', err);
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  }

  async all<T = DbRow>(): Promise<D1Result<T>> {
    try {
      const results = this.stmt.all(...this.params) as T[];
      return {
        success: true,
        results: results || [],
      };
    } catch (err) {
      logger.error('SQLite all() error:', err);
      return {
        success: false,
        error: (err as Error).message,
        results: [],
      };
    }
  }

  // 同步版本（用于 batch）
  runSync(): D1Result {
    try {
      const info = this.stmt.run(...this.params);
      return {
        success: true,
        meta: {
          changes: info.changes,
          last_row_id: info.lastInsertRowid,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  }
}
