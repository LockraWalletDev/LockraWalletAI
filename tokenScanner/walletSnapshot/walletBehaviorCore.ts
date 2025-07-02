import { Connection, PublicKey, ParsedConfirmedTransaction } from "@solana/web3.js"

export interface BehaviorMetrics {
  totalTxCount: number
  averageTxValue: number
  largestTxValue: number
  anomalyCount: number
}

export async function analyzeWalletBehavior(
  connection: Connection,
  walletAddress: PublicKey,
  lookbackSlots: number = 1000
): Promise<BehaviorMetrics> {
  const sigs = await connection.getConfirmedSignaturesForAddress2(walletAddress, { limit: lookbackSlots })
  let totalValue = 0
  let largest = 0
  let anomalyCount = 0

  for (const sig of sigs) {
    const tx = await connection.getParsedConfirmedTransaction(sig.signature)
    if (!tx) continue

    const value = extractTransactionValue(tx)
    totalValue += value
    largest = Math.max(largest, value)
    if (value > largest * 0.5) anomalyCount++  // e.g. large transaction anomaly
  }

  const count = sigs.length
  return {
    totalTxCount: count,
    averageTxValue: count ? parseFloat((totalValue / count).toFixed(2)) : 0,
    largestTxValue: largest,
    anomalyCount,
  }
}

function extractTransactionValue(tx: ParsedConfirmedTransaction): number {
  // Placeholder: sum of lamports moved in transaction
  let sum = 0
  if (tx.meta?.postTokenBalances) {
    for (const tb of tx.meta.postTokenBalances) {
      sum += Number(tb.uiTokenAmount.uiAmount || 0)
    }
  }
  return sum
}