/**
 * behaviorEngineBackground.ts
 * Background service that continuously analyzes on-chain behavior patterns.
 */

import { Connection, PublicKey, ParsedConfirmedTransaction } from "@solana/web3.js"
import { analyzeWalletBehaviorCore, BehaviorMetrics } from "./walletBehaviorCore"
import { EventEmitter } from "events"

export interface BehaviorEngineConfig {
  connection: Connection
  targetAddresses: PublicKey[]
  scanIntervalMs: number
  anomalyThreshold?: number
}

export class BehaviorEngineBackground extends EventEmitter {
  private timerId?: NodeJS.Timer

  constructor(private config: BehaviorEngineConfig) {
    super()
  }

  start(): void {
    this.timerId = setInterval(async () => {
      for (const addr of this.config.targetAddresses) {
        try {
          const metrics: BehaviorMetrics = await analyzeWalletBehaviorCore(
            this.config.connection,
            addr,
            500
          )
          this.emit("metrics", { address: addr.toBase58(), metrics })
          this.checkAnomalies(addr, metrics)
        } catch (err) {
          this.emit("error", err)
        }
      }
    }, this.config.scanIntervalMs)
  }

  stop(): void {
    if (this.timerId) clearInterval(this.timerId)
  }

  private checkAnomalies(addr: PublicKey, metrics: BehaviorMetrics): void {
    const threshold = this.config.anomalyThreshold ?? 0.5
    if (metrics.largestTxValue > metrics.averageTxValue * threshold) {
      this.emit("anomaly", {
        address: addr.toBase58(),
        metrics,
        message: "Unusually large transaction detected"
      })
    }
  }
}
