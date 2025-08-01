// transferDataChecker.ts

import { PublicKey } from "@solana/web3.js"
import { TransferSchemaArgs, transferSchema } from "./defineTransferSchema"
import { z } from "zod"

/**
 * Validate and parse a transfer payload using Zod schema.
 * Throws a ZodError with detailed issues if invalid.
 */
export function validateTransferData(data: unknown): TransferSchemaArgs {
  return transferSchema.parse(data)
}

/**
 * Type guard to check if data matches TransferSchemaArgs.
 */
export function isValidTransferData(data: unknown): data is TransferSchemaArgs {
  if (
    typeof data !== "object" ||
    data === null ||
    typeof (data as any).source !== "string" ||
    typeof (data as any).destination !== "string" ||
    typeof (data as any).tokenMint !== "string" ||
    typeof (data as any).amount !== "number" ||
    (data as any).amount <= 0
  ) {
    return false
  }

  for (const field of ["source", "destination", "tokenMint"] as const) {
    try {
      new PublicKey((data as any)[field])
    } catch {
      return false
    }
  }

  const result = transferSchema.safeParse(data)
  return result.success
}


export function safeParseTransferData(
  data: unknown
): { success: true; data: TransferSchemaArgs } | { success: false; errors: string[] } {
  // Preliminary PublicKey validation
  for (const field of ["source", "destination", "tokenMint"] as const) {
    const value = (data as any)[field]
    if (typeof value !== "string") {
      return { success: false, errors: [`${field} must be a string`] }
    }
    try {
      new PublicKey(value)
    } catch {
      return { success: false, errors: [`${field} is not a valid Solana address`] }
    }
  }

  const result = transferSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`)
  return { success: false, errors }
}
