// traceTokenDistribution.ts

import pLimit from "p-limit"
import { Connection, PublicKey } from "@solana/web3.js"

export interface HolderInfo {
  wallet: string
  amount: number
}

export interface DistributionSummary {
  topHolders: HolderInfo[]
  totalHolders: number
  totalSupply: number
  topShare: number // percentage of top N holders
  concentrationLevel: 'Low' | 'Moderate' | 'High'
}

/**
 * Options for tracing distribution
 */
export interface TraceOptions {
  /** Number of top holders to return (default: 50) */
  topN?: number
  /** Number of top holders to compute share for (default: 10) */
  shareN?: number
  /** Concurrency for processing (default: 5) */
  concurrency?: number
}

/**
 * Analyzes token distribution among holders.
 *
 * @param connection   Solana connection
 * @param mintAddress  Token mint address
 * @param opts         Trace options
 */
export async function traceTokenDistribution(
  connection: Connection,
  mintAddress: string,
  opts: TraceOptions = {}
): Promise<DistributionSummary> {
  const { topN = 50, shareN = 10, concurrency = 5 } = opts

  if (topN < 1 || shareN < 1 || concurrency < 1) {
    throw new RangeError('topN, shareN, and concurrency must be positive integers')
  }

  const mintPubkey = new PublicKey(mintAddress)

  // Fetch parsed token accounts
  const { value: tokenAccounts } = await connection.getParsedTokenAccountsByMint(
    mintPubkey
  )

  // Parse and filter holders
  const holders: HolderInfo[] = tokenAccounts
    .map(acc => {
      const info = (acc.account.data.parsed.info as any)
      return {
        wallet: info.owner as string,
        amount: Number(info.tokenAmount.uiAmount) || 0,
      }
    })
    .filter(h => h.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  const totalHolders = holders.length
  const totalSupply = holders.reduce((sum, h) => sum + h.amount, 0)

  // Determine top holders
  const topHolders = holders.slice(0, topN)

  // Compute share for top shareN holders
  const topShareAmount = holders
    .slice(0, shareN)
    .reduce((sum, h) => sum + h.amount, 0)
  const topShare = totalSupply > 0 ? (topShareAmount / totalSupply) * 100 : 0

  // Determine concentration level
  let concentrationLevel: 'Low' | 'Moderate' | 'High' = 'Low'
  if (topShare > 80) concentrationLevel = 'High'
  else if (topShare > 50) concentrationLevel = 'Moderate'

  return {
    topHolders,
    totalHolders,
    totalSupply,
    topShare: parseFloat(topShare.toFixed(2)),
    concentrationLevel,
  }
}
