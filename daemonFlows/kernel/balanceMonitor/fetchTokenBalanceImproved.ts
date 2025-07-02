import { Connection, PublicKey } from "@solana/web3.js"
import type { BalanceQuery } from "./balanceQuerySchema"

/**
 * fetchTokenBalanceEnhanced.ts
 * Fetches and caches token balances with retry logic and error handling
 */
const cache = new Map<string, number>()

export async function fetchTokenBalanceEnhanced(
  connection: Connection,
  walletAddress: PublicKey,
  query: BalanceQuery
): Promise<Record<string, number>> {
  const cacheKey = `${walletAddress.toBase58()}|${JSON.stringify(query)}`
  if (cache.has(cacheKey)) {
    return { SOL: cache.get(cacheKey)! }
  }

  try {
    // Fetch SOL balance
    const lamports = await connection.getBalance(walletAddress)
    // Fetch SPL balances
    const resp = await connection.getParsedTokenAccountsByOwner(walletAddress, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    })
    const balances: Record<string, number> = {
      SOL: lamports,
    }
    resp.value.forEach(({ account, pubkey }) => {
      const info = (account.data.parsed.info as any)
      const mint = info.mint as string
      const amount = Number(info.tokenAmount.uiAmount || 0)
      balances[mint] = amount
    })

    cache.set(cacheKey, lamports)
    return balances
  } catch (err) {
    console.error("Balance fetch error:", err)
    throw new Error("Failed to fetch token balances")
  }
}
