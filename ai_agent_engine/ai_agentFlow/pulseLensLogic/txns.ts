import { Connection, PublicKey, ParsedConfirmedTransaction } from "@solana/web3.js"
import fs from "fs"

export class TransactionLogger {
  constructor(
    private connection: Connection,
    private logFile: string = "txns.log"
  ) {}

  async recordRecent(address: PublicKey, limit: number = 20): Promise<void> {
    const sigs = await this.connection.getConfirmedSignaturesForAddress2(address, { limit })
    const lines: string[] = []

    for (const sig of sigs) {
      const tx = await this.connection.getParsedConfirmedTransaction(sig.signature)
      const status = tx?.meta?.err ? "failed" : "success"
      lines.push(`${sig.signature} | ${status} | ${new Date((tx?.blockTime||0)*1000).toISOString()}`)
    }

    fs.appendFileSync(this.logFile, lines.join("\n") + "\n")
  }
}
