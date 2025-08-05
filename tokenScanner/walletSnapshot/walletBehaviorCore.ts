import PQueue from "p-queue"
import { Connection, PublicKey, ParsedConfirmedTransaction, ConfirmedSignatureInfo } from "@solana/web3.js"

export interface BehaviorMetrics {
  totalTxCount: number
  averageTxValue: number
  largestTxValue: number
  anomalyCount: number
}

/** Options to tune behavior analysis */
export interface AnalyzeOptions {
  lookbackLimit?: number      // how many signatures to fetch
  concurrency?: number        // how many txs to fetch in parallel
  anomalyPct?: number         // threshold as % of max to count anomaly
}

/**
 * Analyze on-chain behavior for a wallet:
 *  - fetch recent signatures
 *  - batch-fetch parsed transactions
 *  - compute metrics and anomalies
 */
export async function analyzeWalletBehavior(
  connection: Connection,
  walletAddress: PublicKey,
  opts: AnalyzeOptions = {}
): Promise<BehaviorMetrics> {
  const {
    lookbackLimit = 1000,
    concurrency = 10,
    anomalyPct = 0.5,
  } = opts

  // 1) fetch recent signatures
  const sigInfos: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(
    walletAddress,
    { limit: lookbackLimit }
  )

  const signatures = sigInfos.map(s => s.signature)
  const queue = new PQueue({ concurrency })

  let totalValue = 0
  let largest = 0
  let anomalyCount = 0

  // 2) batch‐fetch and process each transaction
  await Promise.all(
    signatures.map(sig => queue.add(async () => {
      const tx = await connection.getParsedConfirmedTransaction(sig)
      if (!tx) return

      const value = extractTransactionValue(tx)
      totalValue += value
      largest = Math.max(largest, value)
    }))
  )

  // 3) second pass to count anomalies (after largest known)
  await Promise.all(
    signatures.map(sig => queue.add(async () => {
      const tx = await connection.getParsedConfirmedTransaction(sig)
      if (!tx) return

      const value = extractTransactionValue(tx)
      if (largest > 0 && value >= largest * anomalyPct) {
        anomalyCount++
      }
    }))
  )

  const count = signatures.length
  return {
    totalTxCount: count,
    averageTxValue: count ? +(totalValue / count).toFixed(2) : 0,
    largestTxValue: largest,
    anomalyCount,
  }
}

/**
 * Extract approximate value of a transaction:
 *  - sum of SOL transfer (pre/post balance diff)
 *  - sum of SPL token movements
 */
function extractTransactionValue(tx: ParsedConfirmedTransaction): number {
  let sum = 0

  // 1) SOL spent by fee-payer: difference in balances
  if (tx.meta?.preBalances && tx.meta.postBalances) {
    const feePayerDelta = tx.meta.preBalances[0] - tx.meta.postBalances[0]
    sum += feePayerDelta / 1e9
  }

  // 2) SPL token movements: use postTokenBalances minus preTokenBalances
  if (tx.meta?.postTokenBalances && tx.meta.preTokenBalances) {
    for (let i = 0; i < tx.meta.postTokenBalances.length; i++) {
      const post = tx.meta.postTokenBalances[i]
      const pre = tx.meta.preTokenBalances.find(p => p.accountIndex === post.accountIndex)
      const delta = (Number(post.uiTokenAmount.uiAmount) - (pre ? Number(pre.uiTokenAmount.uiAmount) : 0))
      sum += delta
    }
  }

  return sum
}
