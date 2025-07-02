/**
 * transferDataChecker.ts
 * Validates the structure and contents of a transfer payload.
 */

import { PublicKey } from "@solana/web3.js"
import type { TransferSchemaArgs } from "./defineTransferSchema"

export function transferDataChecker(data: any): data is TransferSchemaArgs {
  if (
    typeof data !== "object" ||
    typeof data.source !== "string" ||
    typeof data.destination !== "string" ||
    typeof data.tokenMint !== "string" ||
    typeof data.amount !== "number" ||
    data.amount <= 0
  ) {
    return false
  }

  // Validate PublicKey format
  for (const field of ["source", "destination", "tokenMint"] as const) {
    try {
      new PublicKey(data[field])
    } catch {
      return false
    }
  }

  // Optional memo must be a string if present
  if ("memo" in data && typeof data.memo !== "string") {
    return false
  }

  return true
}
