export interface MetricEntry {
  key: string
  value: number
  timestamp: number
}

export interface MetricsCacheConfig {
  /** Time-to-live for entries (ms) */
  ttlMs: number
  /** Maximum history length per key */
  maxSize: number
  /** Optional auto-cleanup interval (ms) */
  cleanupIntervalMs?: number
}

export class MetricsCacheLogic {
  private cache = new Map<string, MetricEntry[]>()  
  private cleanupTimerId: NodeJS.Timeout | null = null

  constructor(private config: MetricsCacheConfig) {
    if (config.cleanupIntervalMs && config.cleanupIntervalMs > 0) {
      this.cleanupTimerId = setInterval(
        () => this.cleanup(),
        config.cleanupIntervalMs
      )
    }
  }

  /**
   * Store a new metric value under a key
   */
  public store(key: string, value: number): void {
    const now = Date.now()
    const entry: MetricEntry = { key, value, timestamp: now }

    // initialize or prune old entries
    const existing = this.getRecent(key)
    existing.push(entry)

    // enforce maxSize
    if (existing.length > this.config.maxSize) {
      existing.splice(0, existing.length - this.config.maxSize)
    }

    this.cache.set(key, existing)
  }

  /**
   * Get all entries for a key within TTL
   */
  public getRecent(key: string): MetricEntry[] {
    const now = Date.now()
    const entries = this.cache.get(key) || []
    const recent = entries.filter(e => now - e.timestamp <= this.config.ttlMs)
    // update stored list if some were expired
    if (recent.length !== entries.length) {
      if (recent.length > 0) {
        this.cache.set(key, recent)
      } else {
        this.cache.delete(key)
      }
    }
    return recent
  }

  /**
   * Compute summary statistics for a key: count, sum, average
   */
  public getStats(key: string): { count: number; sum: number; avg: number } {
    const entries = this.getRecent(key)
    const count = entries.length
    const sum = entries.reduce((a, e) => a + e.value, 0)
    const avg = count > 0 ? sum / count : 0
    return { count, sum, avg }
  }

  /**
   * Remove all expired entries across all keys
   */
  public cleanup(): void {
    const now = Date.now()
    for (const [key, entries] of this.cache.entries()) {
      const recent = entries.filter(e => now - e.timestamp <= this.config.ttlMs)
      if (recent.length > 0) {
        this.cache.set(key, recent)
      } else {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Remove a specific key and its history
   */
  public clearKey(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear entire cache and stop auto-cleanup if configured
   */
  public clearAll(): void {
    this.cache.clear()
    if (this.cleanupTimerId) {
      clearInterval(this.cleanupTimerId)
      this.cleanupTimerId = null
    }
  }

  /**
   * List all keys currently tracked
   */
  public keys(): string[] {
    return Array.from(this.cache.keys())
  }
}
