import { Connection, PublicKey } from "@solana/web3.js"

export interface DexPair {
  baseMint: string
  quoteMint: string
  liquidity: number
}

/**
 * Extracts base/quote mints and liquidity from raw account data
 */
function deserializeDexPair(data: Buffer): DexPair | null {
  if (data.length < 64) return null

  const baseMint = new PublicKey(data.slice(0, 32)).toBase58()
  const quoteMint = new PublicKey(data.slice(32, 64)).toBase58()

  // Replace this with actual logic if layout is known
  const liquidity = 1_000_000 // ← stub value or pull from layout

  return { baseMint, quoteMint, liquidity }
}

/**
 * Scans all program accounts belonging to a DEX program and extracts trading pairs
 */
export async function scanDexPairs(
  connection: Connection,
  programId: PublicKey
): Promise<DexPair[]> {
  const accounts = await connection.getProgramAccounts(programId)
  
  return accounts
    .map(acc => deserializeDexPair(acc.account.data))
    .filter((pair): pair is DexPair => pair !== null)
}
