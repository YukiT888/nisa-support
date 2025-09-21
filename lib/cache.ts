interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  constructor(private ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T) {
    this.store.set(key, { value, expiry: Date.now() + this.ttlMs });
  }
}
