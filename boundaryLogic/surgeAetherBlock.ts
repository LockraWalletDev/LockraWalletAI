
import { Connection, PublicKey, ParsedConfirmedTransaction } from "@solana/web3.js"
import { EventEmitter } from "events"
import { VaultCoreEngine } from "./vaultCoreEngine"

/**
 * Configuration for the surge detector.
 */
export interface SurgeAetherConfig {
  rpcUrl: string
  watchTokens: PublicKey[]
  surgeThreshold: number
  pollIntervalMs: number
  aetherVaultConfig: Parameters<typeof VaultCoreEngine>[0]
}

/**
 * Represents a detected surge event.
 */
export interface SurgeEvent {
  mint: string
  amountMoved: number
  sourceChain: string
  destinationChain: string
  timestamp: number
}

export class SurgeAetherDetector extends EventEmitter {
  private connection: Connection
  private vaultEngine: VaultCoreEngine

  constructor(private config: SurgeAetherConfig) {
    super()
    this.connection = new Connection(config.rpcUrl)
    this.vaultEngine = new VaultCoreEngine(config.aetherVaultConfig)
  }

  async start(): Promise<void> {
    await this.vaultEngine.initialize()
    setInterval(() => this.check(), this.config.pollIntervalMs)
  }

  stop(): void {
    this.vaultEngine.removeAllListeners()
    this.removeAllListeners()
  }

  private async check(): Promise<void> {
    const now = Date.now()
    for (const mint of this.config.watchTokens) {
      const sigs = await this.connection.getConfirmedSignaturesForAddress2(mint, { limit: 20 })
      for (const sig of sigs) {
        const tx = await this.connection.getParsedConfirmedTransaction(sig.signature)
        if (!tx?.meta?.postTokenBalances) continue
        const balances = tx.meta.postTokenBalances
        for (const bal of balances) {
          const amt = Number(bal.uiTokenAmount.uiAmount || 0)
          if (amt >= this.config.surgeThreshold) {
            const event: SurgeEvent = {
              mint: bal.mint,
              amountMoved: amt,
              sourceChain: "Solana",
              destinationChain: "Aether",
              timestamp: now
            }
            this.emit("surge", event)
            // Optionally route through vault
            await this.vaultEngine.executeTransfer({
              destination: this.config.aetherVaultConfig.vaultAddress,
              amount: amt,
              tokenMint: mint
            })
          }
        }
      }
    }
  }
}