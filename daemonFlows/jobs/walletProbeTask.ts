/**
 * walletProbeTaskLogic.ts
 * Core logic for wallet probing tasks: fetch balances, detect anomalies.
 */

import { Connection, PublicKey } from "@solana/web3.js"
import { fetchTokenBalanceEnhanced } from "./fetchTokenBalanceEnhanced"
import { inspectionMap } from "./inspectionMap"

export async function walletProbeTaskLogic(
  connection: Connection,
  walletAddress: PublicKey
): Promise<void> {
  const balances = await fetchTokenBalanceEnhanced(connection, walletAddress, {
    accountAddress: walletAddress.toBase58(),
  })

  for (const [key, inspect] of Object.entries(inspectionMap)) {
    const target = key === "walletInfo"
      ? { address: walletAddress.toBase58(), balance: balances.SOL, tokens: balances }
      : { account: key === "balance" ? walletAddress.toBase58() : "", lamports: balances.SOL }

    const alertTag = inspect(target as any)
    if (alertTag) {
      console.warn(`[Probe][${walletAddress.toBase58()}][${key}]`, alertTag)
    }
  }
}
