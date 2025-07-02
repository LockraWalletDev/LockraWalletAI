
import { Connection, PublicKey, ParsedConfirmedTransaction } from "@solana/web3.js"
import { EventEmitter } from "events"

export interface GenesisEvent {
  mint: string
  txSignature: string
  creator: string
  timestamp: number
}

export interface WatchGenesisConfig {
  rpcUrl: string
  watchProgram: PublicKey
  pollIntervalMs: number
}

export class GenesisWatcher extends EventEmitter {
  private connection: Connection
  private knownSignatures = new Set<string>()

  constructor(private config: WatchGenesisConfig) {
    super()
    this.connection = new Connection(config.rpcUrl)
  }

  start(): void {
    setInterval(() => this.check(), this.config.pollIntervalMs)
  }

  stop(): void {
    this.removeAllListeners()
  }

  private async check(): Promise<void> {
    const sigs = await this.connection.getConfirmedSignaturesForAddress2(
      this.config.watchProgram,
      { limit: 50 }
    )
    const now = Date.now()

    for (const sig of sigs) {
      if (this.knownSignatures.has(sig.signature)) continue
      this.knownSignatures.add(sig.signature)
      const tx = await this.connection.getParsedConfirmedTransaction(sig.signature)
      if (!tx) continue

      const mintInstr = tx.transaction.message.instructions.find(inst =>
        // placeholder: detect mint instruction
        inst.programId.toBase58() === this.config.watchProgram.toBase58()
      )
      if (mintInstr) {
        const event: GenesisEvent = {
          mint: mintInstr.keys[0]?.pubkey.toBase58() || "unknown",
          txSignature: sig.signature,
          creator: tx.transaction.signatures[0] || "unknown",
          timestamp: now
        }
        this.emit("genesis", event)
      }
    }
  }
}