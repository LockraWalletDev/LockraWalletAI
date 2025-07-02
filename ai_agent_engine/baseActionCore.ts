export interface ActionContext {
  payload: Record<string, any>
  meta?: Record<string, any>
}

export type ActionResult = {
  success: boolean
  output?: any
  error?: string
}

export abstract class BaseActionCore {
  protected context: ActionContext

  constructor(initialContext: ActionContext) {
    this.context = initialContext
  }

  abstract validate(): boolean | string
  abstract execute(): Promise<any>

  async run(): Promise<ActionResult> {
    const validation = this.validate()
    if (validation !== true) {
      return { success: false, error: typeof validation === "string" ? validation : "Validation failed" }
    }
    try {
      const output = await this.execute()
      return { success: true, output }
    } catch (err: any) {
      return { success: false, error: err.message || "Execution error" }
    }
  }

  updateContext(updates: Partial<ActionContext>): void {
    this.context = { ...this.context, ...updates }
  }

  getContext(): ActionContext {
    return this.context
  }
}
