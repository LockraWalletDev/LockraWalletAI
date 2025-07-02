

import { Connection, PublicKey } from "@solana/web3.js"
import { BehaviorMetrics, analyzeWalletBehaviorCore } from "./walletBehaviorCore"
import { PricePoint } from "./tokenSpreadAnalyzer"

export interface BlobDataAgentConfig {
  rpcUrl: string
  watchAddresses: PublicKey[]
  batchSize: number
  flushIntervalMs: number
}

export class BlobDataAgent {
  private connection: Connection
  private buffer: any[] = []
  private timer?: NodeJS.Timer

  constructor(private config: BlobDataAgentConfig) {
    this.connection = new Connection(config.rpcUrl)
  }

  start(): void {
    this.timer = setInterval(() => this.flush(), this.config.flushIntervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.flush()
  }

  async collect(): Promise<void> {
    for (const addr of this.config.watchAddresses) {
      const metrics: BehaviorMetrics = await analyzeWalletBehaviorCore(
        this.connection,
        addr
      )
      this.buffer.push({ type: "behavior", address: addr.toBase58(), metrics })
      const pricePoints: PricePoint[] = await this.fetchPriceHistory(addr)
      this.buffer.push({ type: "priceHistory", address: addr.toBase58(), pricePoints })
      if (this.buffer.length >= this.config.batchSize) {
        this.flush()
      }
    }
  }

  private async fetchPriceHistory(addr: PublicKey): Promise<PricePoint[]> {
    // Placeholder: mock price history
    const now = Date.now()
    return Array.from({ length: 5 }, (_, i) => ({
      timestamp: now - i * 60000,
      price: Math.random() * 100,
    }))
  }

  private flush(): void {
    if (!this.buffer.length) return
    // In real case: send to database or message queue
    console.log(`Flushing ${this.buffer.length} records`)
    this.buffer = []
  }
}
