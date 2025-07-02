import { z } from "zod"


export const BalanceSchema = z.object({
  account: z.string().nonempty(),
  lamports: z.number().int().nonnegative(),
})

export const TransferRecordSchema = z.object({
  from: z.string().nonempty(),
  to: z.string().nonempty(),
  amount: z.number().positive(),
  mint: z.string().nonempty(),
  signature: z.string().nonempty(),
})

export const WalletInfoSchema = z.object({
  address: z.string().nonempty(),
  balance: z.number(),
  tokens: z.record(z.string(), z.number()),
})

export type Balance = z.infer<typeof BalanceSchema>
export type TransferRecord = z.infer<typeof TransferRecordSchema>
export type WalletInfo = z.infer<typeof WalletInfoSchema>
