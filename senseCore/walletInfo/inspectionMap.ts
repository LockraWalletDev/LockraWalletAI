import type { Balance, TransferRecord, WalletInfo } from "./dataSchema"



export type InspectionFn<T> = (data: T) => string | null

export const inspectionMap = {
  balance: (b: Balance) =>
    b.lamports < 1_000_000 ? "low-balance-alert" : null,
  transfer: (t: TransferRecord) =>
    t.amount > 1000 ? "large-transfer-flag" : null,
  walletInfo: (w: WalletInfo) =>
    Object.keys(w.tokens).length === 0 ? "no-tokens-found" : null,
} as Record<keyof typeof inspectionMap, InspectionFn<any>>
