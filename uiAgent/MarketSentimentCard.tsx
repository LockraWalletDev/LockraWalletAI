import React from "react"

type Trend = "Bullish" | "Bearish" | "Neutral"

interface MarketSentimentWidgetProps {
  /** 0..100 */
  sentimentScore: number
  trend: Trend
  dominantToken: string
  totalVolume24h: number
  /** e.g. "en-US" (по умолчанию берётся из среды) */
  locale?: string
  /** sm | md | lg (по умолчанию md) */
  size?: "sm" | "md" | "lg"
  className?: string
}

const clamp01 = (n: number) => Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0))

const paletteByTrend: Record<Trend, { fg: string; bg: string; dot: string }> = {
  Bullish: { fg: "text-emerald-700", bg: "bg-emerald-100", dot: "#10b981" },
  Bearish: { fg: "text-rose-700", bg: "bg-rose-100", dot: "#ef4444" },
  Neutral: { fg: "text-amber-800", bg: "bg-amber-100", dot: "#f59e0b" },
}

const sizeMap = {
  sm: { circle: 64, stroke: 8, gap: "gap-3", title: "text-sm" },
  md: { circle: 88, stroke: 10, gap: "gap-4", title: "text-base" },
  lg: { circle: 112, stroke: 12, gap: "gap-5", title: "text-lg" },
}

const formatCompactCurrency = (v: number, locale?: string) =>
  new Intl.NumberFormat(locale, { notation: "compact", style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v)

const arrowByTrend: Record<Trend, string> = {
  Bullish: "▲",
  Bearish: "▼",
  Neutral: "↔",
}

export const MarketSentimentWidget: React.FC<MarketSentimentWidgetProps> = ({
  sentimentScore,
  trend,
  dominantToken,
  totalVolume24h,
  locale,
  size = "md",
  className = "",
}) => {
  const score = clamp01(sentimentScore)
  const angle = Math.round((score / 100) * 360)
  const palette = paletteByTrend[trend]
  const sz = sizeMap[size]
  const ring = {
    // кольцо: процент раскрашен цветом тренда, остаток — светло-серый
    background: `conic-gradient(${palette.dot} ${angle}deg, #e5e7eb ${angle}deg 360deg)`,
    width: sz.circle,
    height: sz.circle,
    borderRadius: "9999px",
  } as React.CSSProperties

  return (
    <section
      className={[
        "rounded-xl p-4 shadow-sm border bg-white/80 dark:bg-neutral-900/60 dark:border-neutral-800",
        className,
      ].join(" ")}
      aria-label="Market Sentiment"
    >
      <header className="mb-3 flex items-center justify-between">
        <h3 className={["font-semibold", sz.title].join(" ")}>Market Sentiment</h3>
        <span
          className={[
            "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium",
            palette.bg,
            palette.fg,
          ].join(" ")}
          title={`Trend: ${trend}`}
        >
          <span className="mr-1" aria-hidden="true">
            {arrowByTrend[trend]}
          </span>
          {trend}
        </span>
      </header>

      <div className={["flex items-center", sz.gap].join(" ")}>
        {/* Радиационный индикатор */}
        <div
          className="relative flex items-center justify-center"
          style={ring}
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
          aria-label="Sentiment score"
          title={`Sentiment: ${score}%`}
        >
          {/* Внутренний диск */}
          <div
            className="absolute rounded-full bg-white dark:bg-neutral-900 flex items-center justify-center"
            style={{
              width: sz.circle - sz.stroke * 2,
              height: sz.circle - sz.stroke * 2,
            }}
          >
            <div className="text-center">
              <div className="text-lg font-semibold">{score}%</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">score</div>
            </div>
          </div>
        </div>

        {/* Детали */}
        <ul className="space-y-1.5 text-sm">
          <li>
            <span className="text-neutral-500 dark:text-neutral-400 mr-1">Dominant Token:</span>
            <strong className="font-medium">{dominantToken}</strong>
          </li>
          <li>
            <span className="text-neutral-500 dark:text-neutral-400 mr-1">24h Volume:</span>
            <strong className="font-medium">{formatCompactCurrency(totalVolume24h, locale)}</strong>
          </li>
          <li>
            <span className="text-neutral-500 dark:text-neutral-400 mr-1">Color:</span>
            <span className="align-middle">
              <span
                className="inline-block w-3 h-3 rounded-full align-[-1px] mr-1"
                style={{ backgroundColor: palette.dot }}
                aria-hidden="true"
              />
              <span className="text-neutral-700 dark:text-neutral-300">{palette.dot}</span>
            </span>
          </li>
        </ul>
      </div>
    </section>
  )
}
