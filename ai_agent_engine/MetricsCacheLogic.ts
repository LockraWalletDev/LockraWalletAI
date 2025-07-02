export interface MetricEntry {
  key: string
  value: number
  timestamp: number
}

export interface MetricsCacheConfig {
  ttlMs: number
  maxSize: number
}

export class MetricsCacheLogic {
  private cache = new Map<string, MetricEntry[]>()

  constructor(private config: MetricsCacheConfig) {}

  store(key: string, value: number): void {
    const entry: MetricEntry = { key, value, timestamp: Date.now() }
    const list = this.cache.get(key) || []
    list.push(entry)
    if (list.length > this.config.maxSize) {
      list.shift()
    }
    this.cache.set(key, list)
  }

  getRecent(key: string): MetricEntry[] {
    const now = Date.now()
    const entries = this.cache.get(key) || []
    return entries.filter(e => now - e.timestamp <= this.config.ttlMs)
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, entries] of this.cache) {
      const filtered = entries.filter(e => now - e.timestamp <= this.config.ttlMs)
      if (filtered.length) {
        this.cache.set(key, filtered)
      } else {
        this.cache.delete(key)
      }
    }
  }
}
