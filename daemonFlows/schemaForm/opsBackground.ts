import { Connection, PublicKey } from "@solana/web3.js"
import { analyzeWalletBehaviorCore, BehaviorMetrics } from "./walletBehaviorCore"
import { EventEmitter } from "events"
import pLimit from "p-limit"

export interface BehaviorEngineConfig {
  connection: Connection
  targetAddresses: PublicKey[]
  scanIntervalMs: number
  anomalyThreshold?: number          // fraction of averageTxValue to flag anomalies
  frequencyThreshold?: number        // transactions per interval to flag burst
  parallelism?: number               // max concurrent address scans
  summaryIntervalMs?: number         // emit periodic summary
  maxCycles?: number                 // Optional: stops after N runs (useful for testing)
}

export interface AnomalyEvent {
  address: string
  metrics: BehaviorMetrics
  type: "large_tx" | "burst_activity"
  message: string
}

export interface SummaryEvent {
  cycleCount: number
  timestamp: number
  overall: {
    totalAddresses: number
    anomaliesDetected: number
  }
}

export class BehaviorEngineBackground extends EventEmitter {
  private timerId?: NodeJS.Timer
  private summaryTimerId?: NodeJS.Timer
  private running: boolean = false
  private cycleCount: number = 0
  private anomaliesCount: number = 0
  private limiter: <T>(fn: () => Promise<T>) => Promise<T>

  constructor(private config: BehaviorEngineConfig) {
    super()
    // default parallelism to 5
    const parallel = config.parallelism ?? 5
    this.limiter = pLimit(parallel)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.cycleCount = 0
    this.anomaliesCount = 0

    // Main scan loop
    this.timerId = setInterval(() => this.runCycle(), this.config.scanIntervalMs)

    // Optional periodic summary
    if (this.config.summaryIntervalMs) {
      this.summaryTimerId = setInterval(
        () => this.emitSummary(),
        this.config.summaryIntervalMs
      )
    }

    this.emit("start", { timestamp: Date.now() })
  }

  stop(): void {
    if (!this.running) return
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = undefined
    }
    if (this.summaryTimerId) {
      clearInterval(this.summaryTimerId)
      this.summaryTimerId = undefined
    }
    this.running = false
    this.emit("stop", { timestamp: Date.now() })
  }

  private async runCycle(): Promise<void> {
    const addresses = this.config.targetAddresses
    const tasks = addresses.map(addr =>
      this.limiter(() => this.processAddress(addr))
    )

    await Promise.all(tasks)
    this.cycleCount++

    if (this.config.maxCycles && this.cycleCount >= this.config.maxCycles) {
      this.stop()
    }
  }

  private async processAddress(addr: PublicKey): Promise<void> {
    try {
      const metrics: BehaviorMetrics = await analyzeWalletBehaviorCore(
        this.config.connection,
        addr,
        this.config.scanIntervalMs
      )

      this.emit("metrics", { address: addr.toBase58(), metrics })

      this.detectLargeTx(addr, metrics)
      this.detectBurstActivity(addr, metrics)
    } catch (err) {
      this.emit("error", { address: addr.toBase58(), error: err })
    }
  }

  private detectLargeTx(addr: PublicKey, metrics: BehaviorMetrics): void {
    const thresholdFrac = this.config.anomalyThreshold ?? 0.5
    const limitValue = metrics.averageTxValue * thresholdFrac

    if (metrics.largestTxValue > limitValue) {
      this.anomaliesCount++
      const event: AnomalyEvent = {
        address: addr.toBase58(),
        metrics,
        type: "large_tx",
        message: `🚨 Large tx: ${metrics.largestTxValue} > ${limitValue.toFixed(2)}`
      }
      this.emit("anomaly", event)
    }
  }

  private detectBurstActivity(addr: PublicKey, metrics: BehaviorMetrics): void {
    const freqThresh = this.config.frequencyThreshold ?? 10
    if (metrics.transactionCount > freqThresh) {
      this.anomaliesCount++
      const event: AnomalyEvent = {
        address: addr.toBase58(),
        metrics,
        type: "burst_activity",
        message: `🔥 Burst: ${metrics.transactionCount} txs in this interval`
      }
      this.emit("anomaly", event)
    }
  }

  private emitSummary(): void {
    const summary: SummaryEvent = {
      cycleCount: this.cycleCount,
      timestamp: Date.now(),
      overall: {
        totalAddresses: this.config.targetAddresses.length,
        anomaliesDetected: this.anomaliesCount
      }
    }
    this.emit("summary", summary)
  }

  // Allows dynamic update of threshold parameters on the fly
  updateConfig(partial: Partial<BehaviorEngineConfig>): void {
    Object.assign(this.config, partial)
    this.emit("configUpdate", { updated: partial, timestamp: Date.now() })
  }

  // Utility to add or remove target addresses at runtime
  addAddress(addr: PublicKey): void {
    this.config.targetAddresses.push(addr)
    this.emit("addressAdded", { address: addr.toBase58() })
  }

  removeAddress(addr: PublicKey): void {
    this.config.targetAddresses = this.config.targetAddresses.filter(
      a => !a.equals(addr)
    )
    this.emit("addressRemoved", { address: addr.toBase58() })
  }
}
