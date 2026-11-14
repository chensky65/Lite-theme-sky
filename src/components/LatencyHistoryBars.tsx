import { latencyBarTone } from "@/lib/home-latency"

/**
 * Komari-style latency history strip: one vertical bar per history bucket.
 * Bar color follows the same tone thresholds as the numeric delay value
 * (green <= 80ms, amber <= 180ms, coral above), so severity reads from color
 * while every valid sample keeps the same height for cross-node comparison.
 * Missing samples render as a short muted bar instead of disappearing.
 */
export default function LatencyHistoryBars({
  values,
  label,
}: {
  values: Array<number | null>
  label?: string
}) {
  return (
    <span className="lite-latency-bars" role="img" aria-label={label}>
      {values.map((value, index) => {
        const tone = latencyBarTone(value)
        const title = value === null || !Number.isFinite(value) || value < 0 ? "无样本" : `${Math.round(value)} ms`
        return <i key={index} className="lite-latency-bars__bar" data-tone={tone} title={title} aria-hidden="true" />
      })}
    </span>
  )
}
