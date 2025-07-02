import { z } from "zod"
import type { TaskResult } from "../vaultTasksHandler"
import type { AssetTransferSchema } from "./transferSchemaMap"

/**
 * Zod schema type for asset transfer
 */
export type TransferSchemaType = typeof AssetTransferSchema

/**
 * Inferred arguments from transfer schema
 */
export type TransferSchemaArgs = z.infer<TransferSchemaType>

/**
 * Payload returned on successful transfer action
 */
export interface TransferResultPayload {
  transactionHash: string
  tokenSymbol: string
}
