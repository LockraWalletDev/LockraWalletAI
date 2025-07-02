/**
 * liquidityFusionCore.ts
 * Aggregates liquidity information from multiple pools and sources.
 */

import { Connection, PublicKey } from "@solana/web3.js"

export interface LiquiditySource {
  name: string
  programId: PublicKey
  poolAddress: PublicKey
}

export interface PoolLiquidity {
  source: string
  liquidity: number
}

export interface FusionResult {
  totalLiquidity: number
  breakdown: PoolLiquidity[]
}

/**
 * Fetches liquidity from a single pool.
 */
async function fetchPoolLiquidity(
  connection: Connection,
  poolAddress: PublicKey
): Promise<number> {
  // Placeholder: read on-chain account data and compute liquidity
  const accountInfo = await connection.getAccountInfo(poolAddress)
  return accountInfo ? Math.random() * 1_000_000 : 0
}

/**
 * Aggregates liquidity across all sources.
 */
export async function fuseLiquidity(
  connection: Connection,
  sources: LiquiditySource[]
): Promise<FusionResult> {
  const breakdown: PoolLiquidity[] = []
  let totalLiquidity = 0

  for (const src of sources) {
    const liq = await fetchPoolLiquidity(connection, src.poolAddress)
    breakdown.push({ source: src.name, liquidity: liq })
    totalLiquidity += liq
  }

  return { totalLiquidity, breakdown }
}
