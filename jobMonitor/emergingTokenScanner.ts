import { Connection, PublicKey, Commitment } from "@solana/web3.js"

export interface TokenInfo {
  mint: string
  firstSeenSlot: number
  symbol?: string
}

/**
 * Scans for recently created SPL token mints on Solana
 *
 * @param connection    RPC connection
 * @param lookbackSlots how many slots back to consider (default: 5000)
 * @param commitment    RPC commitment level (default: “confirmed”)
 */
export async function emergingTokenScanner(
  connection: Connection,
  lookbackSlots = 5000,
  commitment: Commitment = "confirmed"
): Promise<TokenInfo[]> {
  const tokenProgramId = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
  const currentSlot = await connection.getSlot(commitment)
  const startSlot = currentSlot - lookbackSlots

  // Only mint accounts have a data size of 82 bytes
  const filters = [{ dataSize: 82 }]

  // fetch all mint accounts
  const accounts = await connection.getProgramAccounts(
    tokenProgramId,
    { filters, commitment }
  )

  const emerging: TokenInfo[] = []
  for (const { pubkey } of accounts) {
    // fetch the earliest signature for this mint (assumed creation)
    const sigInfos = await connection.getSignaturesForAddress(pubkey, { limit: 1 })
    const firstSeenSlot = sigInfos.length ? sigInfos[0].slot : startSlot

    if (firstSeenSlot >= startSlot) {
      emerging.push({
        mint: pubkey.toBase58(),
        firstSeenSlot,
        // symbol could be fetched via on‑chain metadata; omitted here
      })
    }
  }

  return emerging
}
