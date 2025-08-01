// fetchTokenBalanceEnhanced.ts

import { Connection, PublicKey } from "@solana/web3.js"
import type { BalanceQuery } from "./balanceQuerySchema"
import { z } from "zod"

/**
 * Query schema: optional list of SPL mints to include, and whether to exclude zero balances
 */
const BalanceQuerySchema = z
  .object({
    includeMints: z.array(z.string().min(1)).optional(),
    excludeZero: z.boolean().default(true),
  })
  .strict()

type ParsedBalanceQuery = z.infer<typeof BalanceQuerySchema>

interface CacheEntry {
  data: Record<string, number>
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const DEFAULT_TTL_MS = 60 * 1000 // cache entries live for 1 minute

/**
 * Fetch SOL and SPL token balances with caching, filtering, and TTL.
 *
 * @param connection     Solana RPC connection
 * @param walletAddress  PublicKey of the wallet
 * @param rawQuery       BalanceQuery-like object: { includeMints?: string[]; excludeZero?: boolean }
 */
export async function fetchTokenBalanceEnhanced(
  connection: Connection,
  walletAddress: PublicKey,
  rawQuery: unknown
): Promise<Record<string, number>> {
  // Validate and parse query
  const query: ParsedBalanceQuery = BalanceQuerySchema.parse(rawQuery)

  const key = `${walletAddress.toBase58()}|${JSON.stringify(query)}`
  const now = Date.now()
  const cached = cache.get(key)
  if (cached && cached.expiresAt > now) {
    return { ...cached.data }
  }

  // 1. Fetch SOL balance
  const lamports = await connection.getBalance(walletAddress)

  // 2. Fetch SPL token accounts
  const resp = await connection.getParsedTokenAccountsByOwner(walletAddress, {
    programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  })

  // 3. Build raw balances map
  const balances: Record<string, number> = { SOL: lamports }
  for (const { account } of resp.value) {
    const info = (account.data.parsed.info as any)
    const mint = info.mint as string
    const amount = Number(info.tokenAmount.uiAmount || 0)
    balances[mint] = amount
  }

  // 4. Apply includeMints filter
  let result = balances
  if (query.includeMints) {
    result = Object.fromEntries(
      Object.entries(balances).filter(([mint]) =>
        query.includeMints!.includes(mint)
      )
    )
  }

  // 5. Exclude zero balances if requested
  if (query.excludeZero) {
    result = Object.fromEntries(
      Object.entries(result).filter(([, amount]) => amount > 0)
    )
  }

  // 6. Cache and return
  cache.set(key, {
    data: result,
    expiresAt: now + DEFAULT_TTL_MS,
  })

  return result
}
