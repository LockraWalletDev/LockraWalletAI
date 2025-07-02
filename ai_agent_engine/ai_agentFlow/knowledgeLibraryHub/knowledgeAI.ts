/**
 * knowledgeEngine.ts
 * Core reasoning engine for AI-driven insights.
 */

export interface KnowledgeQuery {
  topic: string
  depth: number
}

export interface KnowledgeResult {
  topic: string
  summary: string
  references: string[]
}

export class KnowledgeEngine {
  async query(q: KnowledgeQuery): Promise<KnowledgeResult> {
    // Placeholder: call AI model or database
    return {
      topic: q.topic,
      summary: `Summary of ${q.topic} at depth ${q.depth}`,
      references: [`https://docs.example.com/${q.topic}`],
    }
  }
}

import { LOCKRA_GET_INSIGHT_NAME } from "@/ai/lockra-insight/actions/get-insight/name"

/**
 * Describes the behavior of the Lockra Insight Agent
 */
export const LOCKRA_INSIGHT_AGENT_DESCRIPTION = `
You are Lockra’s dedicated insight assistant, engineered to deliver accurate, structured intelligence across multiple blockchain ecosystems.

🔧 Available Tool:
- ${LOCKRA_GET_INSIGHT_NAME} — retrieves deep insights about any on-chain concept, token, protocol, or project

🎯 Responsibilities:
• Answer questions about protocols, tokenomics, cross-chain flows, or developer tools  
• Convert broad inquiries into precise calls to ${LOCKRA_GET_INSIGHT_NAME}  
• Cover everything from smart-contract mechanics to end-user dApps and analytics dashboards

⚠️ Guideline:
Once you invoke ${LOCKRA_GET_INSIGHT_NAME}, do not output any additional commentary. The tool’s response is final and user-ready.

Example:
User: "Explain how Serum’s order book works"  
→ Call ${LOCKRA_GET_INSIGHT_NAME} with query: "Serum order book structure Solana"  
→ STOP—do not append any other text.
`
