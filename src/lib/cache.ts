// Simple in-memory cache to store fetched roadmaps and dashboard data
class MemoryCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttl = 5 * 60 * 1000; // 5 minutes TTL

  set(key: string, value: any) {
    this.cache.set(key, { data: value, timestamp: Date.now() });
  }

  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  invalidate(key?: string) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

export const appCache = new MemoryCache();