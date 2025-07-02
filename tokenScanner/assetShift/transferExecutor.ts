import { Wallet } from "@sol/sol-sdk"
import type { TransferSchemaArgs, TaskResult } from "./transferSchemaMap"

/**
 * Executes a token transfer via a Solana wallet instance.
 */
export async function transferExecutor(
  wallet: Wallet,
  args: TransferSchemaArgs
): Promise<TaskResult> {
  // Basic destination validation
  if (args.destination.length !== 44) {
    throw new Error("Invalid destination address")
  }

  // Perform transfer
  const resp = await wallet.createTransfer({
    amount: args.amount,
    assetId: args.tokenMint,
    destination: args.destination,
    gasless: Boolean(args.gasless),
  })

  // Wait for confirmation
  const confirmation = await resp.wait()
  const tx = confirmation.getTransaction()
  if (!tx) {
    throw new Error("Failed to confirm transaction")
  }

  const hash = tx.getTransactionHash()
  if (!hash) {
    throw new Error("Transaction hash missing")
  }

  return {
    status: "success",
    message: `Sent ${args.amount} ${args.tokenMint} → ${args.destination}`,
    txHash: hash,
    link: tx.getTransactionLink(),
  }
}
