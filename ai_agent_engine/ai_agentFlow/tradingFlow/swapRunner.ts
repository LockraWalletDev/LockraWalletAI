
import { Connection, Transaction } from "@solana/web3.js"
import { QuoteFetcher, QuoteParams, QuoteResult } from "./quoteFetcher"

export interface SwapRunConfig {
  connection: Connection
  payerPublicKey: string
  quoteEndpoints: string[]
}

export class SwapRunner {
  private quoteFetcher: QuoteFetcher

  constructor(private config: SwapRunConfig) {
    this.quoteFetcher = new QuoteFetcher(config.quoteEndpoints)
  }

  async runSwap(params: QuoteParams): Promise<string> {
    const best = await this.quoteFetcher.bestQuote(params)
    if (!best) throw new Error("No quote available")

    // Build transaction based on best.quote
    const tx = new Transaction()
    // ... populate swap instructions …

    const sig = await this.config.connection.sendTransaction(tx, [])
    await this.config.connection.confirmTransaction(sig)
    return sig
  }
}
