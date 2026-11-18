export type ProbeTaskRank = {
  name: string
  currentDelay: number | null
  averageDelay?: number | null
  packetLoss: number | null
  availability: number | null
  healthy: boolean
}

function lossRank(value: number | null): number {
  return value === null || !Number.isFinite(value) ? Number.POSITIVE_INFINITY : value
}

function delayRank(value: number | null | undefined): number {
  return value === null || value === undefined || !Number.isFinite(value) ? Number.POSITIVE_INFINITY : value
}

export function pickBestProbeTask<T extends ProbeTaskRank>(summaries: T[]): T | undefined {
  return [...summaries]
    .filter((summary) => summary.healthy && summary.currentDelay !== null)
    .sort((left, right) => {
      const lossDelta = lossRank(left.packetLoss) - lossRank(right.packetLoss)
      if (lossDelta !== 0) return lossDelta
      return delayRank(left.currentDelay) - delayRank(right.currentDelay)
    })[0]
}

export type ProbeRouteStatusKind = "stable" | "jitter" | "degraded" | "outage" | "empty"
export type ProbeRouteStatusTone = "green" | "amber" | "coral" | "muted"

export interface ProbeRouteStatusView {
  status: ProbeRouteStatusKind
  tone: ProbeRouteStatusTone
}

export const PROBE_ROUTE_DEGRADED_LOSS_PERCENT = 5

export function evaluateProbeRouteStatus(
  bestTask: ProbeTaskRank | undefined,
  summaries: ReadonlyArray<{ samples?: number; packetLoss?: number | null; availability?: number | null }> = [],
): ProbeRouteStatusView {
  if (!bestTask) {
    const hasOutageSamples = summaries.some(
      (item) =>
        (typeof item.samples === "number" && item.samples > 0) ||
        item.packetLoss === 100 ||
        item.availability === 0,
    )
    return hasOutageSamples ? { status: "outage", tone: "coral" } : { status: "empty", tone: "muted" }
  }

  const loss =
    bestTask.packetLoss !== null && Number.isFinite(bestTask.packetLoss)
      ? Math.max(0, bestTask.packetLoss)
      : bestTask.availability !== null && Number.isFinite(bestTask.availability)
        ? Math.max(0, 100 - bestTask.availability)
        : 0

  if (loss > PROBE_ROUTE_DEGRADED_LOSS_PERCENT) {
    return { status: "degraded", tone: "coral" }
  }
  if (loss > 0) {
    return { status: "jitter", tone: "amber" }
  }
  return { status: "stable", tone: "green" }
}
