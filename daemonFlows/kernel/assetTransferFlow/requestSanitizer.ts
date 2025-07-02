/**
 * payloadCleaner.ts
 * Cleans and normalizes transfer payload before further processing.
 */

import type { TransferSchemaArgs } from "./defineTransferSchema"

export function payloadCleaner(input: any): TransferSchemaArgs {
  const cleaned: Partial<TransferSchemaArgs> = {
    source: String(input.source || "").trim(),
    destination: String(input.destination || "").trim(),
    tokenMint: String(input.tokenMint || "").trim(),
    amount: Number(input.amount),
    memo: input.memo ? String(input.memo).trim() : undefined,
  }

  // Drop empty optional fields
  if (!cleaned.memo) {
    delete cleaned.memo
  }

  return cleaned as TransferSchemaArgs
}
