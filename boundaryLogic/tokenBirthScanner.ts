import { Connection, PublicKey, Commitment, AccountInfo, Context } from "@solana/web3.js"
import { EventEmitter } from "events"

export interface TokenBirth {
  mint: string
  /** Mint authority (if present in the Mint data); otherwise "unknown" */
  creator: string
  /** Slot at which the mint account change was observed */
  firstSeenSlot: number
  /** Block time (ms) for the slot if available; else Date.now() */
  timestamp: number
}

export interface TokenBirthScannerConfig {
  rpcUrl: string
  /** Polling backstop interval (ms) for periodic resync; set 0 to disable. Default: 60_000 */
  pollIntervalMs?: number
  /** Websocket commitment for subscriptions. Default: "confirmed" */
  commitment?: Commitment
  /**
   * Seed the dedupe set with currently existing mints on start (so only truly new mints emit "birth").
   * This avoids emitting historical mints as if they were new. Default: true
   */
  seedExistingOnStart?: boolean
}

type EventsShape = {
  birth: (birth: TokenBirth) => void
  error: (err: Error) => void
}

/**
 * TokenBirthScanner
 * Efficiently detects new SPL Token mint accounts ("births") by subscribing to
 * Token Program account changes filtered by Mint account data size (82 bytes).
 *
 * Notes:
 * - We derive "creator" from the Mint's `mintAuthority` if present; otherwise "unknown".
 * - We report `firstSeenSlot` from the subscription context; timestamp is blockTime if available.
 * - A periodic resync (getProgramAccounts) acts as a backstop to catch missed websocket events.
 */
export class TokenBirthScanner extends EventEmitter {
  private readonly connection: Connection
  private readonly pollIntervalMs: number
  private readonly commitment: Commitment
  private readonly seedExistingOnStart: boolean

  private wsSubId: number | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private scanning = false

  private readonly TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
  /** Mints have a fixed account size of 82 bytes (Token-2022 mints are larger; extend if needed) */
  private static readonly MINT_ACCOUNT_SIZE = 82

  /** Dedup set of already-seen mint addresses */
  private readonly seenMints = new Set<string>()

  constructor(cfg: TokenBirthScannerConfig) {
    super()
    this.connection = new Connection(cfg.rpcUrl, { commitment: cfg.commitment ?? "confirmed" })
    this.commitment = cfg.commitment ?? "confirmed"
    this.pollIntervalMs = Math.max(0, Math.floor(cfg.pollIntervalMs ?? 60_000))
    this.seedExistingOnStart = cfg.seedExistingOnStart ?? true
  }

  /** Begin scanning (idempotent). Sets up WS subscription plus optional polling backstop. */
  public async start(): Promise<void> {
    if (this.wsSubId !== null || this.pollTimer) return

    if (this.seedExistingOnStart) {
      await this.seedExistingMints()
    }

    // Subscribe to Token Program account changes where dataSize === 82 (Mint accounts).
    this.wsSubId = await this.connection.onProgramAccountChange(
      this.TOKEN_PROGRAM_ID,
      async (info, ctx) => {
        try {
          await this.handleAccountChange(info.accountInfo as AccountInfo<Buffer>, info.accountId.toBase58(), ctx)
        } catch (err) {
          this.emit("error", err as Error)
        }
      },
      {
        commitment: this.commitment,
        filters: [{ dataSize: TokenBirthScanner.MINT_ACCOUNT_SIZE }],
        encoding: "base64" // ensures AccountInfo<Buffer>
      } as any
    )

    // Optional periodic resync (backstop)
    if (this.pollIntervalMs > 0) {
      this.pollTimer = setInterval(() => {
        // fire and forget; errors reported via "error" event
        void this.resyncSnapshot()
      }, this.pollIntervalMs)
      // kick once after start to catch any missed items between seed and subscription start
      void this.resyncSnapshot()
    }
  }

  /** Stop scanning and clear timers/subscriptions. */
  public async stop(): Promise<void> {
    if (this.wsSubId !== null) {
      try {
        await this.connection.removeProgramAccountChangeListener(this.wsSubId)
      } catch {
        // ignore
      }
    }
    this.wsSubId = null
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.scanning = false
  }

  /** Return a copy of currently known (seen) mints. */
  public listSeen(): string[] {
    return Array.from(this.seenMints)
  }

  // ---- internal helpers ----

  private async handleAccountChange(info: AccountInfo<Buffer>, pubkeyBase58: string, ctx: Context): Promise<void> {
    // Dedup: only emit once per mint
    if (this.seenMints.has(pubkeyBase58)) return

    // Parse mint authority (if present) and isInitialized flag
    let creator = "unknown"
    let initialized = false
    try {
      const data = info.data
      if (Buffer.isBuffer(data) && data.length >= TokenBirthScanner.MINT_ACCOUNT_SIZE) {
        // Mint layout (SPL Token v1): 82 bytes
        // u32 mintAuthorityOption LE @0
        // [32] mintAuthority @4
        // u64 supply @36
        // u8 decimals @44
        // u8 isInitialized @45
        // u32 freezeAuthorityOption @46
        // [32] freezeAuthority @50
        const mintAuthOpt = data.readUInt32LE(0)
        if (mintAuthOpt === 1) {
          const auth = new PublicKey(data.subarray(4, 36))
          creator = auth.toBase58()
        }
        initialized = data.readUInt8(45) === 1
      }
    } catch {
      // fall back to "unknown"
    }

    // Only treat as a "birth" once it's initialized
    if (!initialized) {
      // Seed set, but don't emit; prevents repeated checks for uninitialized accounts
      this.seenMints.add(pubkeyBase58)
      return
    }

    this.seenMints.add(pubkeyBase58)

    const slot = ctx.slot
    let tsMs = Date.now()
    try {
      const bt = await this.connection.getBlockTime(slot)
      if (bt && Number.isFinite(bt)) tsMs = bt * 1000
    } catch {
      // keep Date.now()
    }

    const birth: TokenBirth = {
      mint: pubkeyBase58,
      creator,
      firstSeenSlot: slot,
      timestamp: tsMs
    }
    this.emit("birth", birth)
  }

  /** Seed dedupe set with currently existing mints to avoid backfilling as new */
  private async seedExistingMints(): Promise<void> {
    try {
      const accounts = await this.connection.getProgramAccounts(this.TOKEN_PROGRAM_ID, {
        filters: [{ dataSize: TokenBirthScanner.MINT_ACCOUNT_SIZE }],
        commitment: this.commitment
      } as any)
      for (const acc of accounts) {
        this.seenMints.add(acc.pubkey.toBase58())
      }
    } catch (err) {
      this.emit("error", new Error(`seedExistingMints failed: ${(err as Error).message}`))
    }
  }

  /** Periodic snapshot to catch any missed subscriptions; emits only truly new mints */
  private async resyncSnapshot(): Promise<void> {
    if (this.scanning) return
    this.scanning = true
    try {
      const accounts = await this.connection.getProgramAccounts(this.TOKEN_PROGRAM_ID, {
        filters: [{ dataSize: TokenBirthScanner.MINT_ACCOUNT_SIZE }],
        commitment: this.commitment
      } as any)

      const ctxSlot = await this.connection.getSlot(this.commitment)
      let tsMs = Date.now()
      try {
        const bt = await this.connection.getBlockTime(ctxSlot)
        if (bt && Number.isFinite(bt)) tsMs = bt * 1000
      } catch {
        // ignore
      }

      for (const acc of accounts) {
        const mint = acc.pubkey.toBase58()
        if (this.seenMints.has(mint)) continue

        // Parse initialization + mintAuthority
        let initialized = false
        let creator = "unknown"
        const data = acc.account.data as Buffer
        if (Buffer.isBuffer(data) && data.length >= TokenBirthScanner.MINT_ACCOUNT_SIZE) {
          const mintAuthOpt = data.readUInt32LE(0)
          if (mintAuthOpt === 1) {
            creator = new PublicKey(data.subarray(4, 36)).toBase58()
          }
          initialized = data.readUInt8(45) === 1
        }

        this.seenMints.add(mint)
        if (initialized) {
          this.emit("birth", {
            mint,
            creator,
            firstSeenSlot: ctxSlot,
            timestamp: tsMs
          })
        }
      }
    } catch (err) {
      this.emit("error", new Error(`resyncSnapshot failed: ${(err as Error).message}`))
    } finally {
      this.scanning = false
    }
  }

  // ---- typed event overrides ----
  public override on<K extends keyof EventsShape>(event: K, listener: EventsShape[K]): this {
    return super.on(event, listener as any)
  }
  public override once<K extends keyof EventsShape>(event: K, listener: EventsShape[K]): this {
    return super.once(event, listener as any)
  }
  public override off<K extends keyof EventsShape>(event: K, listener: EventsShape[K]): this {
    return super.off(event, listener as any)
  }
}
