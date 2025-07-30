
import { Connection, PublicKey } from "@solana/web3.js"
import { EventEmitter } from "events"

export interface VolatilityRadarConfig {
  rpcUrl: string
  tokenMints: PublicKey[]
  lookbackWindowMs: number
  thresholdPercent: number
  pollIntervalMs: number
}


export interface VolatilityPulse {
  mint: string
  currentPrice: number
  historicalStdDev: number
  pulseScore: number
  timestamp: number
}

export class VolatilityPulseRadar extends EventEmitter {
  private connection: Connection
  private lastPrices: Record<string, number[]> = {}

  constructor(private config: VolatilityRadarConfig) {
    super()
    this.connection = new Connection(config.rpcUrl)
    for (const mint of config.tokenMints) {
      this.lastPrices[mint.toBase58()] = []
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
    for (const mintStr of Object.keys(this.lastPrices)) {
      try {
        const mint = new PublicKey(mintStr)
        const price = await this.fetchPrice(mint)
        const window = this.lastPrices[mintStr]
        window.push(price)
        this.pruneOld(window, now)

        const stdDev = this.calculateStdDev(window)
        const avg = this.calculateAvg(window)
        const pulse = (Math.abs(price - avg) / avg) * 100

        if (pulse >= this.config.thresholdPercent) {
          const event: VolatilityPulse = {
            mint: mintStr,
            currentPrice: price,
            historicalStdDev: stdDev,
            pulseScore: parseFloat(pulse.toFixed(2)),
            timestamp: now
          }
          this.emit("pulse", event)
        }
      } catch (err) {
        this.emit("error", err)
      }
    }
  }

  private pruneOld(window: number[], now: number): void {
    // Keep only points within lookbackWindowMs
    // For simplicity, assume one price per pollInterval
    const maxPoints = Math.ceil(this.config.lookbackWindowMs / this.config.pollIntervalMs)
    if (window.length > maxPoints) {
      window.splice(0, window.length - maxPoints)
    }
  }

  private calculateAvg(values: number[]): number {
    if (!values.length) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  private calculateStdDev(values: number[]): number {
    const avg = this.calculateAvg(values)
    const variance =
      values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length
    return Math.sqrt(variance)
  }

  private async fetchPrice(mint: PublicKey): Promise<number> {
    // Placeholder: call on-chain oracle or external API
    // Simulate with random value for now
    return 1 + Math.random() * 10
  }
}
