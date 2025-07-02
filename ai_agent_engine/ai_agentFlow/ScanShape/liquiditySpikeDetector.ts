/**
 * liquiditySpikeDetector.ts
 * Detects sudden spikes in liquidity over a sliding window.
 */

import { Connection, PublicKey } from "@solana/web3.js"
import { EventEmitter } from "events"

export interface SpikeEvent {
  source: string
  previous: number
  current: number
  percentageChange: number
  timestamp: number
}

export interface SpikeDetectorConfig {
  connection: Connection
  sources: { name: string; poolAddress: PublicKey }[]
  windowSize: number    // number of samples to keep
  thresholdPercent: number // e.g. 50 for +50% spike
  pollIntervalMs: number
}

export class LiquiditySpikeDetector extends EventEmitter {
  private history: Record<string, number[]> = {}

  constructor(private config: SpikeDetectorConfig) {
    super()
    for (const src of config.sources) {
      this.history[src.name] = []
    }
  }

  start(): void {
    setInterval(() => this.scan(), this.config.pollIntervalMs)
  }

  stop(): void {
    this.removeAllListeners()
  }

  private async scan(): Promise<void> {
    const now = Date.now()
    for (const src of this.config.sources) {
      const liq = await this.fetchLiquidity(src.poolAddress)
      const hist = this.history[src.name]
      hist.push(liq)
      if (hist.length > this.config.windowSize) hist.shift()
      if (hist.length === this.config.windowSize) {
        const prev = hist[0]
        const change = ((liq - prev) / prev) * 100
        if (change >= this.config.thresholdPercent) {
          this.emit("spike", {
            source: src.name,
            previous: prev,
            current: liq,
            percentageChange: parseFloat(change.toFixed(2)),
            timestamp: now,
          } as SpikeEvent)
        }
      }
    }
  }

  private async fetchLiquidity(poolAddress: PublicKey): Promise<number> {
    const info = await this.config.connection.getAccountInfo(poolAddress)
    // Placeholder: parse info to number
    return info ? Math.random() * 1_000_000 : 0
  }
}
