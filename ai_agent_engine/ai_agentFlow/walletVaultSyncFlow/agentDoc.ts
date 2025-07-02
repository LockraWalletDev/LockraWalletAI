/**
 * agentDoc.ts
 * Generates and formats documentation for registered agents.
 */

import { CoreAgentFrame, AgentTask } from "./CoreAgentFrame"
import fs from "fs"
import path from "path"

export interface AgentDocConfig {
  outputDir: string
  fileName: string
}

export class AgentDoc {
  private frame: CoreAgentFrame

  constructor(frame: CoreAgentFrame) {
    this.frame = frame
  }

  generate(config: AgentDocConfig): void {
    const tasks: AgentTask[] = (this.frame as any).tasks || []
    const docs = tasks.map(t => this.formatTaskDoc(t)).join("\n\n")
    const fullPath = path.resolve(config.outputDir, config.fileName)
    fs.writeFileSync(fullPath, docs, "utf-8")
    console.log(`Agent documentation written to ${fullPath}`)
  }

  private formatTaskDoc(task: AgentTask): string {
    return [
      `### Task: ${task.id}`,
      `- Description: ${task.run.toString().split("{")[0].trim()}`,
      `- Last Run: N/A`,
      `- Status: Registered`,
      ""
    ].join("\n")
  }
}

// Example usage:
// const frame = new CoreAgentFrame({ heartbeatIntervalMs: 10000 })
// frame.registerTask({ id: "syncRates", run: async () => { /*...*/ } })
// new AgentDoc(frame).generate({ outputDir: "./docs", fileName: "agents.md" })
