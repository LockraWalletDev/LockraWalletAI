

export interface AgentInfo {
  id: string
  status: "idle" | "running" | "error"
  lastHeartbeat: number
}

const registry = new Map<string, AgentInfo>()

export function registerAgent(info: AgentInfo): void {
  registry.set(info.id, info)
}

export function getAgentInfo(id: string): AgentInfo | undefined {
  return registry.get(id)
}

export function listAgents(): AgentInfo[] {
  return Array.from(registry.values())
}
