import {
  PROBE_STRIP_FLUCTUATION_MS_PER_PX,
  PROBE_STRIP_FLUCTUATION_MS_PER_PX_INTERNAL,
  countFittingProbeBars,
  probeHistoryMedian,
  probeStripBarHeight,
  probeStripBarTone,
} from "@/lib/home-latency"
import { useLayoutEffect, useRef, useState } from "react"

/**
 * Combined probe history strip: one bar per history bucket.
 * Bar height shows fluctuation, not absolute latency: the row's median
 * bucket latency maps to the same 10px baseline on every row, and a bar
 * only grows or shrinks from there by its deviation from that median,
 * clamped to 2-16px. The deviation scale is separate per line type:
 * carrier lines use 3ms = 1px, intranet lines (the `internal` prop)
 * use 0.5ms = 1px, because the intranet's sub-ms jitter would be
 * invisible at the carrier scale. So a 0.77ms intranet row and a 148ms
 * carrier row both read as one even row and only their jitter shows.
 * Bar color is purple whenever the bucket had any packet loss — loss
 * outranks latency and matches the loss number above 5% — otherwise it
 * follows the latency tone (green <= 80ms, amber <= 180ms, coral above
 * 180ms), the same tiers as the delay number. Missing samples render as
 * a short muted bar instead of disappearing.
 *
 * Bars are a fixed 4px wide, left-aligned one bar-width after the name
 * column. When the parent passes `visibleCount` it renders exactly that
 * many of the most recent bars; otherwise the strip measures its own
 * width and only renders the most recent bars that fit. Extras are
 * dropped, never shrunk and never spilling past the row. The baseline
 * is the median of the full history, not just the visible bars, so
 * resizing the strip never moves the reference level.
 */
export default function ProbeHistoryStrip({
  latency,
  loss,
  label,
  internal,
  visibleCount: visibleCountProp,
}: {
  latency: Array<number | null>
  loss: Array<number | null>
  label?: string
  internal?: boolean
  visibleCount?: number
}) {
  const stripRef = useRef<HTMLSpanElement>(null)
  const [measuredCount, setMeasuredCount] = useState(latency.length)

  useLayoutEffect(() => {
    if (visibleCountProp !== undefined) return
    const strip = stripRef.current
    if (!strip) return
    const fit = () => {
      const width = strip.clientWidth
      if (width > 0) {
        setMeasuredCount(countFittingProbeBars(width, latency.length))
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(strip)
    return () => observer.disconnect()
  }, [latency.length, visibleCountProp])

  const count = Math.min(visibleCountProp ?? measuredCount, latency.length)
  const start = latency.length - count
  const baseline = probeHistoryMedian(latency)
  const msPerPx = internal ? PROBE_STRIP_FLUCTUATION_MS_PER_PX_INTERNAL : PROBE_STRIP_FLUCTUATION_MS_PER_PX

  return (
    <span ref={stripRef} className="lite-probe-strip" role="img" aria-label={label}>
      {latency.slice(start).map((value, index) => {
        const lossValue = loss[start + index] ?? null
        const tone = probeStripBarTone(value, lossValue)
        const height = probeStripBarHeight(value, baseline, msPerPx)
        const deviation =
          value !== null && Number.isFinite(value) && value >= 0 && baseline !== null
            ? `${value - baseline >= 0 ? "+" : ""}${(value - baseline).toFixed(1)}`
            : null
        const title =
          value === null || !Number.isFinite(value) || value < 0
            ? "无样本"
            : lossValue !== null && Number.isFinite(lossValue) && lossValue > 0
              ? `${Math.round(value)} ms，丢包 ${lossValue.toFixed(1)}%`
              : deviation !== null
                ? `${Math.round(value)} ms（基准 ${baseline?.toFixed(1)} ms，${deviation}）`
                : `${Math.round(value)} ms`
        return (
          <i
            key={start + index}
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
