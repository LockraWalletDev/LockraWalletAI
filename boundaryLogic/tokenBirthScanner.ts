
import { Connection, PublicKey } from "@solana/web3.js"
import { EventEmitter } from "events"
import { DataBlobAgent } from "./blobDataAgent"

export interface TokenBirth {
  mint: string
  creator: string
  firstSeenSlot: number
  timestamp: number
}

export interface TokenBirthScannerConfig {
  rpcUrl: string
  lookbackSlots: number
  pollIntervalMs: number
}

export class TokenBirthScanner extends EventEmitter {
  private connection: Connection
  private seenMints = new Set<string>()

  constructor(private config: TokenBirthScannerConfig) {
    super()
    this.connection = new Connection(config.rpcUrl)
  }

  start(): void {
    setInterval(() => this.scan(), this.config.pollIntervalMs)
  }

  stop(): void {
    this.removeAllListeners()
  }

  private async scan(): Promise<void> {
    const slot = await this.connection.getSlot()
    const start = slot - this.config.lookbackSlots
    const accounts = await this.connection.getProgramAccounts(
      new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
    )
    const now = Date.now()

    for (const acc of accounts) {
      if (acc.account.lamports === 0) {
        const mint = acc.pubkey.toBase58()
        if (!this.seenMints.has(mint)) {
          this.seenMints.add(mint)
          const birth: TokenBirth = {
            mint,
            creator: acc.account.owner?.toBase58() || "unknown",
            firstSeenSlot: start,
            timestamp: now
          }
          this.emit("birth", birth)
        }
      }
    }
  }
}
