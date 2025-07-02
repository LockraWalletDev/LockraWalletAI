/**
 * walletProbeTask.ts
 * Periodically scans a wallet for suspicious activity and generates alerts
 */

import { Connection, PublicKey } from "@solana/web3.js"
import { BehaviorMetrics, analyzeWalletBehaviorCore } from "./walletBehaviorCore"

export interface WalletProbeTaskConfig {
  connection: Connection
  walletAddress: PublicKey
  scanIntervalMs: number
}

export class WalletProbeTask {
  private config: WalletProbeTaskConfig
  private timerId?: NodeJS.Timer

  constructor(config: WalletProbeTaskConfig) {
    this.config = config
  }

  start(): void {
    this.timerId = setInterval(async () => {
      const metrics: BehaviorMetrics = await analyzeWalletBehaviorCore(
        this.config.connection,
        this.config.walletAddress
      )
      this.handleMetrics(metrics)
    }, this.config.scanIntervalMs)
  }

  stop(): void {
    if (this.timerId) clearInterval(this.timerId)
  }

  private handleMetrics(metrics: BehaviorMetrics) {
    // TODO: dispatch notifications or log anomalies
    console.log("Wallet metrics:", metrics)
  }
}
