import React from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { TokenOverviewCard } from "./TokenOverviewCard"
import { MarketSentimentCard } from "./MarketSentimentCard"
import { WalletActivityChart } from "./WalletActivityChart"
import { WhaleSignalBox } from "./WhaleSignalBox"
import { RiskSignalBadge } from "./RiskSignalBadge"
import { AlertBanner } from "./AlertBanner"

export interface AnalyzerOverviewDashboardProps {
  token: {
    name: string
    symbol: string
    price: number
    change24h: number
    liquidity: number
    holders: number
    confidence: number
  }
  sentiment: {
    score: number
    trend: "Bullish" | "Bearish" | "Neutral"
    dominantToken: string
    volume24h: number
  }
  activityData: { time: string; value: number }[]
  whaleTransfers: { walletAddress: string; amountMoved: number; tokenSymbol: string }[]
}

export const AnalyzerOverviewDashboard: React.FC<AnalyzerOverviewDashboardProps> = ({
  token,
  sentiment,
  activityData,
  whaleTransfers
}) => (
  <div className="space-y-6 p-6">
    <AlertBanner message="🚨 Market spike detected! Proceed with caution." />

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <TokenOverviewCard
        tokenName={token.name}
        tokenSymbol={token.symbol}
        currentPrice={token.price}
        change24hPercent={token.change24h}
        totalLiquidity={token.liquidity}
        holderCount={token.holders}
        confidence={token.confidence}
      />

      <MarketSentimentCard
        score={sentiment.score}
        trend={sentiment.trend}
        dominantToken={sentiment.dominantToken}
        volume24h={sentiment.volume24h}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Risk Indicator</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <RiskSignalBadge level={token.change24h >= 0 ? "Low" : "High"} />
        </CardContent>
      </Card>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Wallet Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <WalletActivityChart data={activityData} />
        </CardContent>
      </Card>

      <Card className="overflow-y-auto max-h-96">
        <CardHeader>
          <CardTitle>Recent Whale Transfers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {whaleTransfers.map((t, idx) => (
            <WhaleSignalBox
              key={idx}
              walletAddress={t.walletAddress}
              amountMoved={t.amountMoved}
              tokenSymbol={t.tokenSymbol}
              timestampMs={Date.now() - idx * 60000}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  </div>
)
