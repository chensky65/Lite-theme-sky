import { probeStripBarHeight, probeStripBarTone } from "@/lib/home-latency"

/**
 * Combined probe history strip: one bar per history bucket, full row width.
 * Bar height shows the latency in that bucket (taller = higher latency,
 * 200ms = full height, 2px minimum). Bar color is coral whenever the bucket
 * had any packet loss — loss outranks latency — otherwise it follows the
 * latency tone (green <= 80ms, amber <= 180ms, coral above). Missing samples
 * render as a short muted bar instead of disappearing.
 */
export default function ProbeHistoryStrip({
  latency,
  loss,
  label,
}: {
  latency: Array<number | null>
  loss: Array<number | null>
  label?: string
}) {
  return (
    <span className="lite-probe-strip" role="img" aria-label={label}>
      {latency.map((value, index) => {
        const lossValue = loss[index] ?? null
        const tone = probeStripBarTone(value, lossValue)
        const height = probeStripBarHeight(value)
        const title =
          value === null || !Number.isFinite(value) || value < 0
            ? "无样本"
            : lossValue !== null && Number.isFinite(lossValue) && lossValue > 0
              ? `${Math.round(value)} ms，丢包 ${lossValue.toFixed(1)}%`
              : `${Math.round(value)} ms`
        return (
          <i
            key={index}
            className="lite-probe-strip__bar"
            data-tone={tone}
            style={{ height }}
            title={title}
            aria-hidden="true"
          />
        )
      })}
    </span>
  )
}
