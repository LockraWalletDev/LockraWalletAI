import { Connection, PublicKey } from "@solana/web3.js"
import { EventEmitter } from "events"
import { VaultCoreEngine } from "./vaultCoreEngine"

export interface SurgeAetherConfig {
  rpcUrl: string
  watchTokens: PublicKey[]
  surgeThreshold: number
  pollIntervalMs: number
  aetherVaultConfig: Parameters<typeof VaultCoreEngine>[0]
}

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
  private seenSignatures = new Set<string>()
  private interval: NodeJS.Timer | null = null

  constructor(private config: SurgeAetherConfig) {
    super()
    this.connection = new Connection(config.rpcUrl)
    this.vaultEngine = new VaultCoreEngine(config.aetherVaultConfig)
  }

  async start(): Promise<void> {
    await this.vaultEngine.initialize()
    this.interval = setInterval(() => this.check(), this.config.pollIntervalMs)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.vaultEngine.removeAllListeners()
    this.removeAllListeners()
  }

  private async check(): Promise<void> {
    try {
      const now = Date.now()

      for (const mint of this.config.watchTokens) {
        const sigs = await this.connection.getConfirmedSignaturesForAddress2(mint, { limit: 20 })

        for (const sig of sigs) {
          if (this.seenSignatures.has(sig.signature)) continue
          this.seenSignatures.add(sig.signature)

          const tx = await this.connection.getParsedConfirmedTransaction(sig.signature)
          if (!tx?.meta?.postTokenBalances) continue

          for (const bal of tx.meta.postTokenBalances) {
            if (!bal.mint || !this.config.watchTokens.some(m => m.toBase58() === bal.mint)) continue

            const amt = Number(bal.uiTokenAmount?.uiAmount ?? 0)
            if (isNaN(amt) || amt < this.config.surgeThreshold) continue

            const event: SurgeEvent = {
              mint: bal.mint,
              amountMoved: amt,
              sourceChain: "Solana",
              destinationChain: "Aether",
              timestamp: now
            }

            this.emit("surge", event)

            await this.vaultEngine.executeTransfer({
              destination: this.config.aetherVaultConfig.vaultAddress,
              amount: amt,
              tokenMint: new PublicKey(bal.mint)
            })
          }
        }
      }
    } catch (err) {
      console.error("Surge check failed:", err)
    }
  }
}
