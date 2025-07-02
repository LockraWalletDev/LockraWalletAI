/**
 * whaleSurgeMonitor.ts
 * Monitors large (“whale”) transfers in real-time and emits alerts.
 */

import { Connection, PublicKey, ParsedConfirmedTransaction } from "@solana/web3.js"
import EventEmitter from "events"

export interface WhaleSurgeMonitorConfig {
  connection: Connection
  threshold: number
  pollIntervalMs: number
  watchAddresses: PublicKey[]
}

export class WhaleSurgeMonitor extends EventEmitter {
  private timer?: NodeJS.Timer

  constructor(private config: WhaleSurgeMonitorConfig) {
    super()
  }

  start(): void {
    this.timer = setInterval(async () => {
      for (const addr of this.config.watchAddresses) {
        const sigs = await this.config.connection.getConfirmedSignaturesForAddress2(addr, { limit: 20 })
        for (const sig of sigs) {
          const tx = await this.config.connection.getParsedConfirmedTransaction(sig.signature)
          if (!tx?.meta?.postTokenBalances) continue

          for (const bal of tx.meta.postTokenBalances) {
            const amt = Number(bal.uiTokenAmount.uiAmount || 0)
            if (amt >= this.config.threshold) {
              this.emit("surge", {
                signature: sig.signature,
                amount: amt,
                mint: bal.mint,
                from: bal.owner,
                to: addr.toBase58(),
                timestamp: (tx.blockTime || Date.now() / 1000) * 1000,
              })
            }
          }
        }
      }
    }, this.config.pollIntervalMs)
  }

  stop(): void {
    clearInterval(this.timer!)
  }
}
