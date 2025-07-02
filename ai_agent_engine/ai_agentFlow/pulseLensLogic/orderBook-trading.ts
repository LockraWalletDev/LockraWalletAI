import { Connection, PublicKey } from "@solana/web3.js"

export interface OrderBookEntry {
  price: number
  size: number
  side: "buy" | "sell"
}

export class OrderBookManager {
  constructor(private connection: Connection, private market: PublicKey) {}

  async fetchOrderBook(limit: number = 50): Promise<OrderBookEntry[]> {
    // Placeholder: fetch bids and asks then merge by price
    // In real use: call Serum or DEX API
    const mock: OrderBookEntry[] = []
    for (let i = 0; i < limit; i++) {
      mock.push({
        price: 1 + Math.random(),
        size: Math.random() * 100,
        side: i % 2 ? "buy" : "sell",
      })
    }
    return mock.sort((a, b) => b.price - a.price)
  }
}
