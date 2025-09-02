import { Connection, PublicKey, Commitment } from "@solana/web3.js"
import { BehaviorMetrics, analyzeWalletBehaviorCore } from "./walletBehaviorCore"
import { PricePoint } from "./tokenSpreadAnalyzer"

export interface BlobDataAgentConfig {
  rpcUrl: string
  watchAddresses: Array<PublicKey | string>
  /** Flush when buffered records reach this size (default: 100) */
  batchSize?: number
  /** Periodic flush interval in ms (default: 60_000) */
  flushIntervalMs?: number
  /** Connection commitment (default: "confirmed") */
  commitment?: Commitment
  /**
   * Optional sink to persist batches (DB, MQ, etc.).
   * If not provided, a concise console log is used.
   */
  sink?: (records: BlobRecord[]) => Promise<void> | void
  /**
   * Optional price history fetcher.
   * Default is a deterministic stub (no randomness).
   */
  priceHistoryFetcher?: (connection: Connection, address: PublicKey) => Promise<PricePoint[]>
}

/** Record shapes persisted by the agent */
export type BlobRecord =
  | { type: "behavior"; address: string; metrics: BehaviorMetrics }
  | { type: "priceHistory"; address: string; pricePoints: PricePoint[] }

export class BlobDataAgent {
  private readonly connection: Connection
  private readonly batchSize: number
  private readonly flushIntervalMs: number
  private readonly sink: (records: BlobRecord[]) => Promise<void>
  private readonly fetchPriceHistoryFn: (connection: Connection, addr: PublicKey) => Promise<PricePoint[]>

  private buffer: BlobRecord[] = []
  private flushTimer?: NodeJS.Timeout
  private flushing = false
  private collecting = false
  private watch: PublicKey[] = []
  private stopped = true

  constructor(private readonly config: BlobDataAgentConfig) {
    if (!config?.rpcUrl) throw new Error("rpcUrl is required")
    if (!Array.isArray(config.watchAddresses) || config.watchAddresses.length === 0) {
      throw new Error("watchAddresses must be a non-empty array")
    }
    this.batchSize = Math.max(1, Math.floor(config.batchSize ?? 100))
    this.flushIntervalMs = Math.max(1_000, Math.floor(config.flushIntervalMs ?? 60_000))

    this.connection = new Connection(config.rpcUrl, { commitment: config.commitment ?? "confirmed" })

    // Deduplicate and normalize watch addresses
    const dedup = new Set<string>()
    for (const a of config.watchAddresses) {
      const pk = typeof a === "string" ? new PublicKey(a) : a
      dedup.add(pk.toBase58())
    }
    this.watch = Array.from(dedup).map(s => new PublicKey(s))

    this.sink = async (records: BlobRecord[]) => {
      if (records.length === 0) return
      if (typeof config.sink === "function") {
        await config.sink(records)
      } else {
        // Default: concise deterministic log (no record contents)
        // eslint-disable-next-line no-console
        console.log(`[BlobDataAgent] flushed ${records.length} records`)
      }
    }

    this.fetchPriceHistoryFn =
      config.priceHistoryFetcher ?? (async (_conn, addr) => deterministicPriceStub(addr, 5, 60_000))
  }

  /** Start periodic flushing (idempotent). Call collect() manually when desired. */
  start(): void {
    if (!this.stopped) return
    this.stopped = false
    if (!this.flushTimer) {
      this.flushTimer = setInterval(() => {
        void this.flush().catch(err => {
          // eslint-disable-next-line no-console
          console.error("[BlobDataAgent] flush error:", err?.message || String(err))
        })
      }, this.flushIntervalMs)
    }
  }

  /** Stop periodic flushing and force a final flush. */
  async stop(): Promise<void> {
    this.stopped = true
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = undefined
    }
    await this.flush().catch(err => {
      // eslint-disable-next-line no-console
      console.error("[BlobDataAgent] final flush error:", err?.message || String(err))
    })
  }

  /** Replace the watch set atomically (deduped). */
  setWatchAddresses(addresses: Array<PublicKey | string>): void {
    const dedup = new Set<string>()
    for (const a of addresses) {
      const pk = typeof a === "string" ? new PublicKey(a) : a
      dedup.add(pk.toBase58())
    }
    this.watch = Array.from(dedup).map(s => new PublicKey(s))
  }

  /** Get current watch addresses (base58). */
  getWatchAddresses(): string[] {
    return this.watch.map(pk => pk.toBase58())
  }

  /**
   * Collect metrics for all watch addresses.
   * Safe against re-entrancy; overlapping calls are ignored.
   */
  async collect(): Promise<void> {
    if (this.collecting) return
    this.collecting = true
    try {
      // Snapshot the list to avoid races with setWatchAddresses()
      const targets = [...this.watch]
      for (const addr of targets) {
        try {
          const metrics: BehaviorMetrics = await analyzeWalletBehaviorCore(this.connection, addr)
          this.buffer.push({ type: "behavior", address: addr.toBase58(), metrics })

          const pricePoints: PricePoint[] = await this.fetchPriceHistoryFn(this.connection, addr)
          this.buffer.push({ type: "priceHistory", address: addr.toBase58(), pricePoints })
        } catch (e: any) {
          // eslint-disable-next-line no-console
          console.error("[BlobDataAgent] collect error:", e?.message || String(e), "addr=", addr.toBase58())
        }

        if (this.buffer.length >= this.batchSize) {
          await this.flush()
        }
      }
    } finally {
      this.collecting = false
    }
  }

  /** Force a flush of buffered records (noop if empty). */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return
    this.flushing = true
    const batch = this.buffer.splice(0)
    try {
      await this.sink(batch)
    } catch (e) {
      // Re-queue on failure to avoid data loss
      this.buffer = batch.concat(this.buffer)
      throw e
    } finally {
      this.flushing = false
    }
  }
}

/* --------------------- Deterministic stub helpers --------------------- */

/**
 * Deterministic price history stub (no randomness).
 * Produces `count` points spaced by `stepMs`, newest first.
 */
function deterministicPriceStub(addr: PublicKey, count: number, stepMs: number): PricePoint[] {
  const base = hashToUnit(addr.toBase58()) * 100 // 0..100
  const now = Date.now()
  const out: PricePoint[] = []
  for (let i = 0; i < count; i++) {
    // gentle drift with fixed slope; clamp to 2 decimals
    const price = round2(base + i * 0.123)
    out.push({ timestamp: now - i * stepMs, price })
  }
  return out
}

/** Simple, deterministic string hash mapped to [0,1). */
function hashToUnit(s: string): number {
  let h = 2166136261 >>> 0 // FNV-1a seed
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // Normalize to [0,1)
  return (h >>> 0) / 0xffffffff
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}
