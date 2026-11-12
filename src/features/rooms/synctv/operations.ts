/** Port of fixed appv1.1.32 PlaybackOperationTracker (Apache-2.0). */
export class PlaybackOperations<T> {
  private operations = new Map<
    string,
    { previous: T; parent?: string; created: number; acknowledged: boolean }
  >();
  private active?: string;
  constructor(private now = Date.now) {}
  private prune() {
    for (const [id, value] of this.operations)
      if (this.now() - value.created > 60000) {
        this.operations.delete(id);
        if (this.active === id) this.active = undefined;
      }
  }
  remember(id: string, previous: T) {
    this.prune();
    this.operations.set(id, {
      previous,
      parent: this.active,
      created: this.now(),
      acknowledged: false,
    });
    this.active = id;
  }
  acknowledge(id: string, state: T): { handled: boolean; state?: T } {
    this.prune();
    const operation = this.operations.get(id);
    if (!operation) return { handled: false };
    if (operation.acknowledged) return { handled: true };
    operation.acknowledged = true;
    if (this.active === id) {
      this.active = undefined;
      return { handled: true, state };
    }
    const dependent = [...this.operations.values()].find(
      (item) => item.parent === id
    );
    if (dependent) {
      dependent.previous = state;
      dependent.parent = operation.parent;
    }
    return { handled: true };
  }
  reject(id: string): { handled: boolean; state?: T } {
    this.prune();
    const operation = this.operations.get(id);
    this.operations.delete(id);
    if (!operation || operation.acknowledged) return { handled: false };
    if (this.active === id) {
      this.active = operation.parent;
      return { handled: true, state: operation.previous };
    }
    const dependent = [...this.operations.values()].find(
      (item) => item.parent === id
    );
    if (dependent) {
      dependent.previous = operation.previous;
      dependent.parent = operation.parent;
    }
    return { handled: true };
  }
  clear() {
    this.operations.clear();
    this.active = undefined;
  }
}
