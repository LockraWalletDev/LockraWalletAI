import axios, { AxiosInstance } from "axios"
import {
  Connection,
  PublicKey,
  Commitment,
} from "@solana/web3.js"

export interface TokenBalance {
  mint: string
  amount: number
}

/** Extra fields we may attach while still satisfying TokenBalance[] */
export interface TokenBalanceDetailed extends TokenBalance {
  /** Sum of all accounts for this mint */
  uiAmount?: number
  /** SPL token decimals (if known) */
  decimals?: number
}

export interface RetrieveBalancesOptions {
  /** Prefer calling an indexer first (default: true) */
  preferIndexer?: boolean
  /** Base URL for indexer; if undefined and preferIndexer=true, uses example default */
  indexerBaseUrl?: string
  /** Optional API key for indexer */
  apiKey?: string
  /** Axios instance (optional) */
  http?: AxiosInstance
  /** Request timeout for indexer (ms, default 5000) */
  timeoutMs?: number
  /** Retry attempts for indexer (default 2) */
  retries?: number
  /** Base backoff for retries; delay = base * attempt^2 (default 250ms) */
  backoffMs?: number
  /** Include zero-balance mints in the result (default false) */
  includeZero?: boolean
  /** Commitment level for on-chain fallback (default "confirmed") */
  commitment?: Commitment
  /** Sort result by descending amount (default true) */
  sortDesc?: boolean
}

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")

/**
 * Retrieve SPL token balances for a wallet.
 * Strategy:
 *  1) Try indexer API (fast), with retries and timeout.
 *  2) Fallback to on-chain scan via getParsedTokenAccountsByOwner (robust).
 */
export async function retrieveTokenBalances(
  connection: Connection,
  walletAddress: PublicKey,
  opts: RetrieveBalancesOptions = {}
): Promise<TokenBalance[]> {
  const {
    preferIndexer = true,
    indexerBaseUrl = "https://api.indexer.example.com",
    apiKey,
    http = axios.create(),
    timeoutMs = 5000,
    retries = 2,
    backoffMs = 250,
    includeZero = false,
    commitment = "confirmed",
    sortDesc = true,
  } = opts

  if (!(walletAddress instanceof PublicKey)) {
    throw new Error("walletAddress must be a PublicKey")
  }

  if (preferIndexer && indexerBaseUrl) {
    try {
      const balances = await fetchFromIndexer(
        http,
        indexerBaseUrl,
        walletAddress.toBase58(),
        { apiKey, timeoutMs, retries, backoffMs }
      )
      const cleaned = sanitizeBalances(balances, { includeZero, sortDesc })
      // If indexer returned something, we’re done; otherwise, fall through to on-chain.
      if (cleaned.length > 0) return cleaned
    } catch {
      // ignore and fall back to chain
    }
  }

  const fromChain = await fetchFromChain(connection, walletAddress, { commitment })
  return sanitizeBalances(fromChain, { includeZero, sortDesc })
}

// -------------------- Indexer path --------------------

async function fetchFromIndexer(
  http: AxiosInstance,
  baseUrl: string,
  owner58: string,
  opts: { apiKey?: string; timeoutMs: number; retries: number; backoffMs: number }
): Promise<TokenBalanceDetailed[]> {
  const url = `${trimEndSlash(baseUrl)}/wallets/${encodeURIComponent(owner58)}/balances`
  const headers = opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : undefined
  let lastErr: any

  for (let attempt = 1; attempt <= opts.retries + 1; attempt++) {
    try {
      const resp = await http.get<{ balances: Array<{ mint: string; amount: number; decimals?: number }> }>(url, {
        headers,
        timeout: opts.timeoutMs,
      })
      const list = resp.data?.balances ?? []
      return list.map(b => ({
        mint: String(b.mint),
        amount: Number(b.amount),
        uiAmount: Number(b.amount),
        decimals: typeof b.decimals === "number" ? b.decimals : undefined,
      }))
    } catch (err) {
      lastErr = err
      if (attempt <= opts.retries && isRetryable(err)) {
        const d = opts.backoffMs * attempt * attempt
        await delay(d)
        continue
      }
      throw lastErr
    }
  }
  // unreachable
  throw lastErr
}

// -------------------- On-chain fallback --------------------

async function fetchFromChain(
  connection: Connection,
  owner: PublicKey,
  opts: { commitment: Commitment }
): Promise<TokenBalanceDetailed[]> {
  const map = new Map<string, { amount: number; decimals?: number; uiAmount?: number }>()
  const res = await connection.getParsedTokenAccountsByOwner(
    owner,
    { programId: TOKEN_PROGRAM_ID },
    opts.commitment
  )

  for (const { account } of res.value) {
    const parsed: any = account.data?.parsed
    if (!parsed || parsed.type !== "account") continue

    const info = parsed.info
    const mint = String(info.mint)
    const tokenAmount = info.tokenAmount
    if (!mint || !tokenAmount) continue

    // tokenAmount:
    // { amount: "123", decimals: 6, uiAmount: 0.000123, uiAmountString: "0.000123" }
    const decimals: number = Number(tokenAmount.decimals ?? 0)
    // Prefer uiAmount (already float); fallback to amount/10^decimals
    const uiAmount: number =
      typeof tokenAmount.uiAmount === "number" && Number.isFinite(tokenAmount.uiAmount)
        ? tokenAmount.uiAmount
        : safeDiv(Number(tokenAmount.amount ?? 0), Math.pow(10, decimals))

    const prev = map.get(mint) ?? { amount: 0, decimals, uiAmount: 0 }
    prev.amount += uiAmount
    prev.uiAmount = (prev.uiAmount ?? 0) + uiAmount
    prev.decimals = decimals
    map.set(mint, prev)
  }

  const out: TokenBalanceDetailed[] = []
  for (const [mint, v] of map.entries()) {
    out.push({ mint, amount: v.amount, uiAmount: v.uiAmount, decimals: v.decimals })
  }
  return out
}

// -------------------- Utilities --------------------

function sanitizeBalances(
  list: TokenBalanceDetailed[],
  opts: { includeZero: boolean; sortDesc: boolean }
): TokenBalance[] {
  const filtered = list
    .filter(b => b && typeof b.mint === "string")
    .map(b => ({ ...b, amount: Number(b.amount) }))
    .filter(b => Number.isFinite(b.amount))

  const final = opts.includeZero ? filtered : filtered.filter(b => b.amount > 0)

  if (opts.sortDesc) final.sort((a, b) => b.amount - a.amount)
  return final
}

function isRetryable(err: any): boolean {
  const code = err?.code ?? err?.response?.status
  const msg = String(err?.message ?? "").toLowerCase()
  if (code === 408 || code === 429) return true
  if (typeof code === "number" && code >= 500) return true
  return msg.includes("timeout") || msg.includes("network") || msg.includes("econnreset")
}

function delay(ms: number) {
  return new Promise(res => setTimeout(res, Math.max(0, ms)))
}

function safeDiv(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0
  return a / b
}

function trimEndSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s
}
