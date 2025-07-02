/**
 * walletSchemaChecker.ts
 * Validates on-chain wallet data against the expected schema/shape
 */

import { PublicKey } from "@solana/web3.js"
import { PricePoint } from "./tokenSpreadAnalyzer"

export interface WalletSchema {
  address: string
  balance: number
  tokenHoldings: Record<string, number>
  lastUpdated: number
}

export class WalletSchemaChecker {
  static validate(data: any): data is WalletSchema {
    return (
      typeof data === "object" &&
      typeof data.address === "string" &&
      typeof data.balance === "number" &&
      typeof data.tokenHoldings === "object" &&
      typeof data.lastUpdated === "number"
    )
  }

  static assert(data: any): WalletSchema {
    if (!this.validate(data)) {
      throw new Error("Invalid wallet schema")
    }
    return data
  }
}
