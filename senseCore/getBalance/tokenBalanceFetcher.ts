import { Connection, PublicKey } from "@solana/web3.js"
import type { Balance } from "./dataSchema"


export async function fetchTokenBalance(
  connection: Connection,
  walletAddress: PublicKey
): Promise<Balance[]> {
  const balances: Balance[] = []

  // SOL balance
  const lamports = await connection.getBalance(walletAddress)
  balances.push({ account: walletAddress.toBase58(), lamports })

  // SPL-token balances
  const resp = await connection.getParsedTokenAccountsByOwner(walletAddress, {
    programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  })
  for (const { pubkey, account } of resp.value) {
    const info = account.data.parsed.info
    const mint = info.mint as string
    const amount = Number(info.tokenAmount.uiAmount)
    balances.push({ account: mint, lamports: amount })
  }

  return balances
}
