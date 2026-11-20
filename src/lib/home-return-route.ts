export type PublicReturnRouteTaskLine = {
  pingTaskId: string
  line: string
}

export type PublicReturnRoute = {
  client: string
  lines: string[]
  tasks: PublicReturnRouteTaskLine[]
  suspectedBlocked: boolean
  highConfidence: boolean
}

export type PublicReturnRouteByServer = Record<string, PublicReturnRoute>

function asReturnRouteList(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
  }
  if (!value || typeof value !== "object") return []
  const record = value as Record<string, unknown>
  for (const key of ["data", "routes", "result"]) {
    if (Array.isArray(record[key])) return asReturnRouteList(record[key])
  }
  return []
}

function uniqueLines(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const line = String(item || "").trim()
    if (!line || seen.has(line)) continue
    seen.add(line)
    out.push(line)
  }
  return out
}

function mapTaskLines(value: unknown): PublicReturnRouteTaskLine[] {
  if (!Array.isArray(value)) return []
  const out: PublicReturnRouteTaskLine[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const pingTaskId = String(record.ping_task_id ?? record.pingTaskId ?? "").trim()
    const line = String(record.line ?? "").trim()
    if (!pingTaskId || pingTaskId === "0" || !line || seen.has(pingTaskId)) continue
    seen.add(pingTaskId)
    out.push({ pingTaskId, line })
  }
  return out
}

export function mapPublicReturnRoutes(input: unknown): PublicReturnRouteByServer {
  const out: PublicReturnRouteByServer = {}
  for (const item of asReturnRouteList(input)) {
    const client = String(item.client || "").trim()
    if (!client) continue
    const lines = uniqueLines(item.lines)
    const tasks = mapTaskLines(item.tasks)
    const suspectedBlocked = Boolean(item.suspected_blocked)
    const highConfidence = suspectedBlocked && Boolean(item.high_confidence)
    if (!lines.length && !tasks.length && !suspectedBlocked) continue
    const route: PublicReturnRoute = { client, lines, tasks, suspectedBlocked, highConfidence }
    out[client] = route
    out[client.toLowerCase()] = route
  }
  return out
}

export function returnRouteForServer(map: PublicReturnRouteByServer, uuid?: string): PublicReturnRoute | undefined {
  const client = String(uuid || "").trim()
  if (!client) return undefined
  return map[client] || map[client.toLowerCase()]
}

export function returnLineForPingTask(route: PublicReturnRoute | undefined | null, taskId: string): string {
  if (!route) return ""
  const id = String(taskId || "").trim()
  if (!id) return ""
  return route.tasks.find((item) => item.pingTaskId === id)?.line || ""
}

/* Quality tier of a return line, for the capsule color. Only CN2 GIA is
   premium; CN2 GT, CMIN2 and CUG VIP are optimized; the internal network
   is its own tier (not a carrier route); anything else, including 163 and
   CMI, is regular. */
export type ReturnLineQuality = "premium" | "optimized" | "regular" | "internal"

export function returnLineQuality(line: string): ReturnLineQuality {
  const label = String(line || "").trim().toUpperCase()
  if (!label) return "regular"
  if (label === "1" || label.includes("内网") || label.includes("LAN")) return "internal"
  if (label.includes("GIA")) return "premium"
  if (label.includes("CUG VIP") || label.includes("CN2 GT") || label.includes("CMIN2")) return "optimized"
  return "regular"
}

export function hasPublicReturnRoute(route?: PublicReturnRoute | null): boolean {
  if (!route) return false
  return route.lines.length > 0 || route.tasks.length > 0 || route.suspectedBlocked
}
