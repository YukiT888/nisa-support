/**
 * @template TValue
 */
class TTLCache {
  /**
   * @param {number} ttlMs
   */
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    /** @type {Map<string, { value: TValue; expiresAt: number }>} */
    this.entries = new Map();
  }

  /**
   * @param {string} key
   * @returns {TValue | undefined}
   */
  get(key) {
    const now = Date.now();
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * @param {string} key
   * @param {TValue} value
   */
  set(key, value) {
    const expiresAt = Date.now() + this.ttlMs;
    this.entries.set(key, { value, expiresAt });
  }

  /**
   * @param {string} key
   */
  delete(key) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }
}

/**
 * @template {any[]} TArgs
 * @template TValue
 * @param {( ...args: TArgs) => Promise<TValue> | TValue} fn
 * @param {{ ttlMs: number; getKey?: (...args: TArgs) => string }} options
 * @returns {( ...args: TArgs) => Promise<TValue>}
 */
function memoizeWithTTL(fn, options) {
  const cache = new TTLCache(options.ttlMs);
  const getKey = options.getKey ?? ((...args) => JSON.stringify(args));

  return async (...args) => {
    const key = getKey(...args);
    const hit = cache.get(key);
    if (hit !== undefined) {
      return hit;
    }

    const value = await fn(...args);
    cache.set(key, value);
    return value;
  };
}

export { TTLCache, memoizeWithTTL };
