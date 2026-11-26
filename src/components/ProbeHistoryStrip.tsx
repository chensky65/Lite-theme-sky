import { countFittingProbeBars, probeStripBarHeight, probeStripBarTone } from "@/lib/home-latency"
import { useLayoutEffect, useRef, useState } from "react"

/**
 * Combined probe history strip: one bar per history bucket.
 * Bar height shows the latency in that bucket (taller = higher latency,
 * 200ms = full height, 2px minimum). Bar color is coral whenever the bucket
 * had any packet loss — loss outranks latency — otherwise it follows the
 * latency tone (green <= 80ms, amber <= 180ms, coral above). Missing samples
 * render as a short muted bar instead of disappearing.
 *
 * Bars are a fixed 6px wide, left-aligned one bar-width after the name
 * column. When the parent passes `visibleCount` it renders exactly that
 * many of the most recent bars; otherwise the strip measures its own
 * width and only renders the most recent bars that fit. Extras are
 * dropped, never shrunk and never spilling past the row.
 */
export default function ProbeHistoryStrip({
  latency,
  loss,
  label,
  visibleCount: visibleCountProp,
}: {
  latency: Array<number | null>
  loss: Array<number | null>
  label?: string
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

  return (
    <span ref={stripRef} className="lite-probe-strip" role="img" aria-label={label}>
      {latency.slice(start).map((value, index) => {
        const lossValue = loss[start + index] ?? null
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
