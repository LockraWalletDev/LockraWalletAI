/**
 * chainOrchestrator.ts
 * Manages transaction flows across multiple chains and modules.
 */

import { Connection, PublicKey, Transaction, ParsedConfirmedTransaction } from "@solana/web3.js"
import { EventEmitter } from "events"
import { VaultCoreEngine } from "./vaultCoreEngine"
import { transferExecutor } from "./transferExecutor"

export interface ChainOrchestratorConfig {
  rpcUrl: string
  vaultConfig: Parameters<typeof VaultCoreEngine>[0]
  monitorAddresses: PublicKey[]
  pollIntervalMs: number
}

export class ChainOrchestrator extends EventEmitter {
  private connection: Connection
  private timer?: NodeJS.Timer
  private vaultEngine: VaultCoreEngine

  constructor(private config: ChainOrchestratorConfig) {
    super()
    this.connection = new Connection(config.rpcUrl)
    this.vaultEngine = new VaultCoreEngine(config.vaultConfig)
  }

  async start(): Promise<void> {
    await this.vaultEngine.initialize()
    this.timer = setInterval(() => this.poll(), this.config.pollIntervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  private async poll(): Promise<void> {
    try {
      for (const addr of this.config.monitorAddresses) {
        const sigs = await this.connection.getConfirmedSignaturesForAddress2(addr, { limit: 10 })
        for (const sig of sigs) {
          const tx = await this.connection.getParsedConfirmedTransaction(sig.signature)
          if (tx && tx.meta?.postTokenBalances) {
            this.emit("transaction", tx)
            this.handleTransaction(tx)
          }
        }
      }
    } catch (err) {
      this.emit("error", err)
    }
  }

  private async handleTransaction(tx: ParsedConfirmedTransaction): Promise<void> {
    const transfers = tx.meta!.postTokenBalances!.map((bal) => ({
      owner: bal.owner ?? "",
      mint: bal.mint,
      amount: Number(bal.uiTokenAmount.uiAmount || 0)
    }))
    for (const t of transfers) {
      if (t.amount > 10000) {
        // Large transfer: route through vault
        await this.vaultEngine.executeTransfer({
          destination: new PublicKey(t.owner),
          amount: t.amount,
          tokenMint: new PublicKey(t.mint)
        })
        this.emit("vaultTransfer", t)
      } else {
        // Small transfer: direct swap
        const txSig = await transferExecutor(this.connection, this.vaultEngine.config.authority, {
          source: this.vaultEngine.config.vaultAddress.toBase58(),
          destination: t.owner,
          tokenMint: t.mint,
          amount: t.amount,
        })
        this.emit("directTransfer", { ...t, signature: txSig })
      }
    }
  }
}
