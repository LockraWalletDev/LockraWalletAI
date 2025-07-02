/**
 * tokenWatchlistManager.ts
 * Manages a user's watchlist of tokens in-memory
 */

export class TokenWatchlistManager {
  private watchlist = new Set<string>()

  addToken(symbol: string): void {
    this.watchlist.add(symbol.toUpperCase())
  }

  removeToken(symbol: string): void {
    this.watchlist.delete(symbol.toUpperCase())
  }

  hasToken(symbol: string): boolean {
    return this.watchlist.has(symbol.toUpperCase())
  }

  listTokens(): string[] {
    return Array.from(this.watchlist)
  }

  clear(): void {
    this.watchlist.clear()
  }
}
