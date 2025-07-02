

export function renderDetails(detail: Record<string, any>): string {
  return Object.entries(detail)
    .map(([key, val]) => `${key}: ${JSON.stringify(val)}`)
    .join("; ")
}
