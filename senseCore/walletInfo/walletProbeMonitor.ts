import { Connection, PublicKey } from "@solana/web3.js"
import type { WalletInfo } from "./dataSchema"
import { fetchTokenBalance } from "./tokenBalanceFetcher"
import { inspectionMap } from "./inspectionMap"


export class WalletProbeMonitor {
  constructor(
    private connection: Connection,
    private address: PublicKey,
    private intervalMs: number = 60_000
  ) {}

  start(): void {
    setInterval(async () => {
      const balances = await fetchTokenBalance(this.connection, this.address)
      const summary = {
        address: this.address.toBase58(),
        balance: balances.find(b => b.account === this.address.toBase58())?.lamports ?? 0,
        tokens: Object.fromEntries(
          balances.filter(b => b.account !== this.address.toBase58()).map(b => [b.account, b.lamports])
        ),
      } as WalletInfo

      // run inspections
      for (const [key, fn] of Object.entries(inspectionMap)) {
        const rule = (inspectionMap as any)[key]
        const target = key === "walletInfo" ? summary : balances.find(b => key === "balance")!
        const alert = rule(target)
        if (alert) console.warn(`Alert [${key}]:`, alert, target)
      }
    }, this.intervalMs)
  }
}
