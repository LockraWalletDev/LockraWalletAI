/**
 * whaleMovementTracker.ts
 * Tracks large on-chain SPL token transfers (“whale movements”) above a threshold.
 *
 * Improvements over the baseline:
 * - Uses modern web3.js APIs (`getSignaturesForAddress`, `getParsedTransaction`)
 * - Parses SPL-token transfer/transferChecked instructions to identify true token movements
 * - Filters by watched wallets (either sender or recipient)
 * - Optional mint allowlist, commitment, max sigs per address, and pagination cursor
 * - Robust amount decoding for both parsed instruction shapes
 * - Batches RPC calls with a simple concurrency limiter
 */

import {
  Commitment,
  Connection,
  ParsedInstruction,
  ParsedTransactionWithMeta,
  PublicKey,
} from "@solana/web3.js"

export interface WhaleTransfer {
  signature: string
  amount: number          // UI units
  mint: string
  from: string
  to: string
  timestamp: number       // ms
}

export interface WhaleTrackerOptions {
  /** Whale threshold in UI units (default 100_000) */
  threshold?: number
  /** Limit signatures per address (1–100, default 100) */
  maxSignaturesPerAddress?: number
  /** Optional mint filter (base58 strings); empty = all mints */
  mintAllowlist?: string[]
  /** Commitment level for RPC calls (default "confirmed") */
  commitment?: Commitment
  /**
   * Pagination cursor: only fetch signatures BEFORE this one (exclusive).
   * Useful for walking back in time. If omitted, fetch most recent page.
   */
  beforeSignature?: string
  /** Max concurrent `getParsedTransaction` calls (default 8) */
  concurrency?: number
}

/**
 * Track large SPL token movements for a set of wallet addresses.
 * Includes transfers where watched wallet is either sender or recipient.
 */
export async function whaleMovementTracker(
  connection: Connection,
  walletAddresses: PublicKey[],
  opts: WhaleTrackerOptions | number = {}
): Promise<WhaleTransfer[]> {
  const {
    threshold = typeof opts === "number" ? opts : (opts as WhaleTrackerOptions).threshold ?? 100_000,
    maxSignaturesPerAddress = typeof opts === "number" ? 100 : (opts as WhaleTrackerOptions).maxSignaturesPerAddress ?? 100,
    mintAllowlist = typeof opts === "number" ? [] : (opts as WhaleTrackerOptions).mintAllowlist ?? [],
    commitment = typeof opts === "number" ? "confirmed" : (opts as WhaleTrackerOptions).commitment ?? "confirmed",
    beforeSignature = typeof opts === "number" ? undefined : (opts as WhaleTrackerOptions).beforeSignature,
    concurrency = typeof opts === "number" ? 8 : (opts as WhaleTrackerOptions).concurrency ?? 8,
  } = typeof opts === "number" ? ({} as WhaleTrackerOptions) : (opts as WhaleTrackerOptions)

  const watchedSet = new Set(walletAddresses.map((k) => k.toBase58()))
  const allowSet = mintAllowlist.length ? new Set(mintAllowlist) : undefined

  // 1) Fetch recent signatures for each watched address
  const perAddressSigs = await Promise.all(
    walletAddresses.map((addr) =>
      connection.getSignaturesForAddress(
        addr,
        {
          limit: clamp(maxSignaturesPerAddress, 1, 100),
          before: beforeSignature,
        },
        commitment
      )
    )
  )

  // Flatten & dedupe signatures (same tx may involve multiple watched addresses)
  const sigSet = new Set<string>()
  for (const list of perAddressSigs) {
    for (const s of list) sigSet.add(s.signature)
  }
  const signatures = Array.from(sigSet)

  // 2) Fetch parsed transactions with bounded concurrency
  const transfers: WhaleTransfer[] = []
  const key = (t: WhaleTransfer) => `${t.signature}:${t.mint}:${t.from}:${t.to}:${t.amount}`
  const seen = new Set<string>()

  const limit = pLimit(concurrency)
  await Promise.all(
    signatures.map((sig) =>
      limit(async () => {
        const tx = await connection.getParsedTransaction(sig, { commitment })
        if (!tx) return
        const tsMs = ((tx.blockTime ?? Math.floor(Date.now() / 1000)) * 1000) | 0
        const moves = extractSPLTransfers(tx)

        for (const m of moves) {
          if (m.amount < threshold) continue
          if (allowSet && !allowSet.has(m.mint)) continue
          if (!watchedSet.has(m.from) && !watchedSet.has(m.to)) continue

          const item: WhaleTransfer = {
            signature: sig,
            amount: m.amount,
            mint: m.mint,
            from: m.from,
            to: m.to,
            timestamp: tsMs,
          }
          const k = key(item)
          if (!seen.has(k)) {
            seen.add(k)
            transfers.push(item)
          }
        }
      })
    )
  )

  // Sort newest first for convenience
  transfers.sort((a, b) => b.timestamp - a.timestamp || a.signature.localeCompare(b.signature))
  return transfers
}

/* -------------------------- helpers -------------------------- */

/** Simple concurrency limiter without deps */
function pLimit(max: number) {
  const queue: Array<() => void> = []
  let active = 0
  const next = () => {
    active--
    if (queue.length) queue.shift()!()
  }
  return async function <T>(fn: () => Promise<T>): Promise<T> {
    if (active >= Math.max(1, max)) {
      await new Promise<void>((res) => queue.push(res))
    }
    active++
    try {
      return await fn()
    } finally {
      next()
    }
  }
}

function clamp(n: number, min: number, max: number) {
  n = Math.floor(n)
  if (n < min) return min
  if (n > max) return max
  return n
}

/**
 * Extract SPL token transfers from a parsed transaction.
 * Supports "transfer" and "transferChecked" instruction shapes.
 */
function extractSPLTransfers(
  tx: ParsedTransactionWithMeta
): Array<{ from: string; to: string; mint: string; amount: number }> {
  if (!tx.transaction) return []
  const out: Array<{ from: string; to: string; mint: string; amount: number }> = []

  const instructions = tx.transaction.message.instructions as ParsedInstruction[]

  // Build a decimals map from token balances for precise UI conversion when needed
  const decimalsByMint: Record<string, number> = {}
  const balances = [...(tx.meta?.preTokenBalances ?? []), ...(tx.meta?.postTokenBalances ?? [])]
  for (const b of balances) {
    const mint = b.mint
    const dec = Number(b.uiTokenAmount.decimals ?? 0)
    if (mint && Number.isFinite(dec)) decimalsByMint[mint] = dec
  }

  for (const ix of instructions) {
    // Parsed instruction
    const p: any = (ix as any).parsed
    if (!p || (p.type !== "transfer" && p.type !== "transferChecked")) continue
    const info = p.info || {}

    const source: string | undefined = info.source || info.authority || info.owner
    const destination: string | undefined = info.destination
    const mint: string | undefined = info.mint

    if (!source || !destination || !mint) continue

    let uiAmount: number | undefined

    // transferChecked usually has tokenAmount { amount, decimals }
    if (p.type === "transferChecked" && info.tokenAmount) {
      const raw = Number(info.tokenAmount.amount)
      const dec = Number(info.tokenAmount.decimals)
      if (Number.isFinite(raw) && Number.isFinite(dec)) {
        uiAmount = raw / Math.pow(10, dec)
      }
    }

    // transfer may only have 'amount' (raw) or sometimes already ui string
    if (uiAmount === undefined) {
      const dec = decimalsByMint[mint] ?? Number(info.decimals ?? 0)
      const amtRawStr = info.amount ?? info.tokenAmount?.amount ?? info.uiAmount
      if (amtRawStr !== undefined) {
        const n = Number(amtRawStr)
        if (Number.isFinite(n)) {
          // Heuristic: if it's an integer and very large, treat as raw; else assume UI
          if (Number.isInteger(n) && dec > 0 && n > Math.pow(10, dec)) {
            uiAmount = n / Math.pow(10, dec)
          } else {
            uiAmount = info.uiAmount !== undefined ? n : n / Math.pow(10, dec)
          }
        }
      }
    }

    if (uiAmount !== undefined && Number.isFinite(uiAmount)) {
      out.push({
        from: source,
        to: destination,
        mint,
        amount: uiAmount,
      })
    }
  }

  return out
}
