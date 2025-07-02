/**
 * applyLogic.ts
 * Core orchestrator that applies a series of logic handlers to input data.
 */

import { AnomalousBehavior, AnomalyResult } from "./anomalousBehavior"
import { SoLanaTokenInfo, fetchTokenBalanceEnhanced } from "./fetchTokenBalanceEnhanced"
import { RiskResult, assessRisk } from "./riskAssessmentEngine"
import { InspectionFn, inspectionMap } from "./inspectionMap"

export interface LogicContext {
  walletAddress?: string
  metrics?: any
  seriesData?: any
  tokenData?: SoLanaTokenInfo
}

export type LogicHandler = (ctx: LogicContext) => Promise<LogicContext | AnomalyResult[]>

export class LogicOrchestrator {
  private handlers: LogicHandler[] = []

  addHandler(handler: LogicHandler): this {
    this.handlers.push(handler)
    return this
  }

  async run(initial: LogicContext): Promise<LogicContext> {
    let ctx: LogicContext = { ...initial }
    for (const handler of this.handlers) {
      const result = await handler(ctx)
      if (Array.isArray(result)) {
        console.warn("Anomalies detected:", result)
      } else {
        ctx = { ...ctx, ...result }
      }
    }
    return ctx
  }
}

// Example handlers

export async function walletInspectionHandler(ctx: LogicContext): Promise<LogicContext> {
  if (!ctx.walletAddress) return ctx
  const balances = await fetchTokenBalanceEnhanced(
    /* connection */ null as any,
    /* walletAddress */ null as any,
    { accountAddress: ctx.walletAddress }
  )
  return { ...ctx, metrics: balances }
}

export async function anomalyDetectionHandler(ctx: LogicContext): Promise<AnomalyResult[]> {
  if (!ctx.metrics) return []
  const analyzer = new AnomalousBehavior()
  return analyzer.analyzeTransfers(ctx.metrics)
}

export async function riskAssessmentHandler(ctx: LogicContext): Promise<LogicContext> {
  if (!ctx.metrics) return ctx
  const risk = assessRisk({
    volatility: 0.5,
    transactionCount: ctx.metrics.totalTxCount,
    averageTransferSize: ctx.metrics.averageTxValue
  })
  return { ...ctx, seriesData: risk }
}
