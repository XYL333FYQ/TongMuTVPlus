import { processSingleton } from './process-singleton';

// 简单的内存锁管理器
class LockManager {
  private locks: Map<string, { locked: boolean; queue: Array<() => void> }> =
    new Map();
  private readonly LOCK_TIMEOUT = 10000; // 10秒超时

  async acquire(key: string): Promise<() => void> {
    // 获取或创建锁对象
    let lock = this.locks.get(key);
    if (!lock) {
      lock = { locked: false, queue: [] };
      this.locks.set(key, lock);
    }

    // 如果锁未被占用，立即获取
    if (!lock.locked) {
      lock.locked = true;

      // 设置超时自动释放
      const timeoutId = setTimeout(() => {
        this.release(key);
      }, this.LOCK_TIMEOUT);

      // 返回释放函数
      return () => {
        clearTimeout(timeoutId);
        this.release(key);
      };
    }

    // 如果锁已被占用，等待
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // 超时，从队列中移除
        const index = lock.queue.indexOf(callback);
        if (index > -1) {
          lock.queue.splice(index, 1);
        }
        reject(new Error('获取锁超时'));
      }, this.LOCK_TIMEOUT);

      const callback = () => {
        clearTimeout(timeoutId);
        lock.locked = true;

        // 设置超时自动释放
        const lockTimeoutId = setTimeout(() => {
          this.release(key);
        }, this.LOCK_TIMEOUT);

        resolve(() => {
          clearTimeout(lockTimeoutId);
          this.release(key);
        });
      };

      lock.queue.push(callback);
    });
  }

  private release(key: string): void {
    const lock = this.locks.get(key);
    if (!lock) return;

    // 如果队列中有等待者，唤醒下一个
    if (lock.queue.length > 0) {
      const next = lock.queue.shift();
      if (next) {
        next();
      }
    } else {
      // 没有等待者，释放锁
      lock.locked = false;
      // 清理空的锁对象
      this.locks.delete(key);
    }
  }

  // 清理所有锁（用于测试或重置）
  clear(): void {
    this.locks.clear();
  }
}

// 全局单例
export const lockManager = processSingleton(
  Symbol.for('__MOONTV_LOCK_MANAGER__'),
  () => new LockManager()
);
