/**
 * tokenScanner.ts
 * Scans on-chain data for specified tokens and returns detailed info.
 */

import { Connection, PublicKey } from "@solana/web3.js"
import { TokenInfo } from "./emergingTokenScanner"

export interface DetailedTokenInfo extends TokenInfo {
  holders?: number
  volume24h?: number
  recentTxCount?: number
}

export async function tokenScanner(
  connection: Connection,
  tokenMints: PublicKey[]
): Promise<DetailedTokenInfo[]> {
  const infos: DetailedTokenInfo[] = []

  for (const mint of tokenMints) {
    // fetch basic info
    const supply = await connection.getTokenSupply(mint)
    const holders = await connection.getTokenLargestAccounts(mint)
    const txs = await connection.getSignaturesForAddress(mint)

    infos.push({
      mint: mint.toBase58(),
      firstSeenSlot: 0,
      symbol: await getSymbolFromMint(mint),
      holders: holders.value.length,
      volume24h: estimateVolume(txs),
      recentTxCount: txs.length
    })
  }

  return infos
}

async function getSymbolFromMint(mint: PublicKey): Promise<string> {
  // placeholder: lookup symbol from on-chain metadata
  return mint.toBase58().slice(0, 4)
}

function estimateVolume(txs: Array<{ signature: string; blockTime?: number }>): number {
  // placeholder: simplistic volume estimate
  return txs.length * 100
}
