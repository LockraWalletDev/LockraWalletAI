import React from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export interface MarketSentimentCardProps {
  score: number // 0–100
  trend: "Bullish" | "Bearish" | "Neutral"
  dominantToken: string
  volume24h: number
}

function getSentimentColorClass(score: number): string {
  if (score >= 70) return "bg-green-500"
  if (score >= 40) return "bg-orange-500"
  return "bg-red-500"
}

export const MarketSentimentCard: React.FC<MarketSentimentCardProps> = ({
  score,
  trend,
  dominantToken,
  volume24h
}) => (
  <Card className="max-w-md mx-auto my-4">
    <CardHeader>
      <CardTitle className="text-lg font-semibold">Market Sentiment</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex items-center space-x-4">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl ${getSentimentColorClass(
            score
          )}`}
        >
          {score}%
        </div>
        <ul className="space-y-1 text-sm text-gray-700">
          <li>
            <span className="font-medium">Trend:</span> {trend}
          </li>
          <li>
            <span className="font-medium">Dominant Token:</span> {dominantToken}
          </li>
          <li>
            <span className="font-medium">24h Volume:</span> ${volume24h.toLocaleString()}
          </li>
        </ul>
      </div>
    </CardContent>
  </Card>
)
