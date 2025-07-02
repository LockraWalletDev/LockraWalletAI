/**
 * whaleMovementTracker.ts
 * Tracks large on-chain transfers (“whale movements”) above a given threshold.
 */

import { Connection, PublicKey, ParsedConfirmedTransaction, TokenBalance } from "@solana/web3.js"

export interface WhaleTransfer {
  signature: string
  amount: number
  mint: string
  from: string
  to: string
  timestamp: number
}

export async function whaleMovementTracker(
  connection: Connection,
  walletAddresses: PublicKey[],
  threshold: number = 100_000
): Promise<WhaleTransfer[]> {
  const transfers: WhaleTransfer[] = []

  for (const addr of walletAddresses) {
    const sigs = await connection.getConfirmedSignaturesForAddress2(addr, { limit: 100 })
    for (const sig of sigs) {
      const tx = await connection.getParsedConfirmedTransaction(sig.signature)
      if (!tx || !tx.meta?.postTokenBalances) continue

      for (const bal of tx.meta.postTokenBalances as TokenBalance[]) {
        const amt = Number(bal.uiTokenAmount.uiAmount || 0)
        if (amt >= threshold) {
          transfers.push({
            signature: sig.signature,
            amount: amt,
            mint: bal.mint,
            from: bal.owner || "unknown",
            to: addr.toBase58(),
            timestamp: (tx.blockTime || Date.now() / 1000) * 1000,
          })
        }
      }
    }
  }

  return transfers
}
