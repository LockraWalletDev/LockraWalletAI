
export interface DataItem {
  id: string
  payload: any
  timestamp: number
}

export interface DataSetConfig {
  maxSize?: number
  ttlMs?: number
}

export class DataSetManager {
  private items: DataItem[] = []

  constructor(private config: DataSetConfig = {}) {}

  add(item: DataItem): void {
    this.items.push(item)
    this.enforceLimits()
  }

  removeById(id: string): boolean {
    const initialLength = this.items.length
    this.items = this.items.filter(i => i.id !== id)
    return this.items.length < initialLength
  }

  getById(id: string): DataItem | undefined {
    return this.items.find(i => i.id === id)
  }

  filter(predicate: (item: DataItem) => boolean): DataItem[] {
    return this.items.filter(predicate)
  }

  batchAdd(newItems: DataItem[]): void {
    this.items.push(...newItems)
    this.enforceLimits()
  }

  size(): number {
    return this.items.length
  }

  clear(): void {
    this.items = []
  }

  getAll(): DataItem[] {
    return [...this.items]
  }

  private enforceLimits(): void {
    const now = Date.now()
    if (this.config.ttlMs != null) {
      this.items = this.items.filter(i => now - i.timestamp <= this.config.ttlMs!)
    }
    if (this.config.maxSize != null && this.items.length > this.config.maxSize) {
      this.items.splice(0, this.items.length - this.config.maxSize)
    }
  }
}
