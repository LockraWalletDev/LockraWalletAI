import { PublicKey, Transaction } from "@solana/web3.js"
import sodium from "libsodium-wrappers"

export class SigningEngine {
  async signAndSend(
    tx: Transaction,
    signerKeypair: { publicKey: PublicKey; secretKey: Uint8Array },
    connection: { sendRawTransaction(data: Buffer): Promise<string>; confirmTransaction(sig: string): Promise<void> }
  ): Promise<string> {
    await sodium.ready
    const signature = sodium.crypto_sign_detached(
      tx.serializeMessage(),
      signerKeypair.secretKey
    )
    tx.addSignature(signerKeypair.publicKey, Buffer.from(signature))
    const raw = tx.serialize()
    const txSig = await connection.sendRawTransaction(raw)
    await connection.confirmTransaction(txSig)
    return txSig
  }
}
