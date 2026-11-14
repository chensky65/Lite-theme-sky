import { lossBarTone } from "@/lib/home-latency"

/**
 * Packet-loss history strip: one small square per history bucket, mirroring
 * the latency strip above it. Color follows the loss in that bucket
 * (green 0%, amber (0, 5)%, coral >= 5%), so loss bursts read from color.
 * Missing samples render as a muted square instead of disappearing.
 */
export default function PacketLossHistoryBars({
  values,
  label,
}: {
  values: Array<number | null>
  label?: string
}) {
  return (
    <span className="lite-latency-bars" role="img" aria-label={label}>
      {values.map((value, index) => {
        const tone = lossBarTone(value)
        const title =
          value === null || !Number.isFinite(value) || value < 0 ? "无样本" : `丢包 ${value.toFixed(1)}%`
        return <i key={index} className="lite-latency-bars__bar" data-tone={tone} title={title} aria-hidden="true" />
      })}
    </span>
  )
}
