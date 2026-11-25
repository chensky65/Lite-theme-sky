import ProbeHistoryStrip from "@/components/ProbeHistoryStrip"
import {
  HOME_LATENCY_CARD_LIMIT,
  type HomeLatencyTaskSummary,
  formatProbeLatency,
  formatProbePacketLoss,
  hourPacketFillPercent,
  latencyBarTone,
} from "@/lib/home-latency"
import { probeAccentIndex } from "@/lib/home-probe-accent"
import { returnLineForPingTask, returnLineQuality, type PublicReturnRoute } from "@/lib/home-return-route"
import { readShowHomePacketLoss, readShowHomeReturnRoute } from "@/lib/theme-config"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

/* Operator brand marks for the probe rows: the carriers' official graphic
   marks (icon only, no wordmark), inlined as SVG so they need no asset
   file. Telecom is the blue swirl (#1e6292), Mobile the blue/green wave
   (#0e84c7 / #95c122), Unicom the red knot (#e50017). Anything else
   (e.g. the internal network) gets no mark. */
function operatorLogo(taskName: string): React.ReactNode {
  if (taskName.includes("电信")) {
    return (
      <svg viewBox="0 0 46 46" width="24" height="24" aria-hidden="true">
        <g><path d="M14.762 3.93c.117.448.205.89.349 1.311.11.324.036.468-.282.607-1.764.769-3.446 1.687-4.967 2.874-1.045.817-2.01 1.715-2.67 2.889-1.146 2.034-.603 3.932 1.448 5.06 1.416.778 2.954 1.131 4.548 1.299.359.037.446-.079.49-.423.475-3.69 1.321-7.278 3.023-10.62.808-1.585 1.787-3.053 3.167-4.207 1.084-.907 2.3-1.517 3.755-1.513 1.608.005 2.906.74 4.051 1.79 1.417 1.297 2.382 2.912 3.24 4.704-.607.162-1.186.323-1.77.462-.07.016-.178-.09-.256-.152-1.244-1.014-2.484-.918-3.56.287-.793.886-1.291 1.94-1.702 3.042-.697 1.862-1.074 3.8-1.34 5.762-.011.085-.001.172-.001.33.684-.155 1.326-.28 1.957-.447 3.2-.847 6.278-1.996 9.085-3.786 1.629-1.039 3.134-2.218 4.131-3.926 1.08-1.85.686-3.702-1.138-4.818-.805-.492-1.742-.776-2.633-1.117-.26-.1-.441-.181-.506-.48-.144-.657-.323-1.305-.513-2.059.85.079 1.636.13 2.416.227 2.225.276 4.389.787 6.416 1.78 1.408.69 2.656 1.592 3.527 2.917 1.225 1.86 1.222 3.835.389 5.836-.955 2.294-2.63 4.017-4.514 5.562-3.098 2.54-6.629 4.292-10.365 5.663a46 46 0 0 1-8.192 2.172c-.312.052-.438.177-.416.5.224 3.247.526 6.484 1.699 9.56.27.707.672 1.365 1.036 2.035.105.192.27.36.43.514.803.77 1.735.749 2.49-.072.863-.938 1.363-2.087 1.681-3.291.39-1.473.657-2.978.993-4.465.034-.151.15-.368.272-.403.962-.273 1.935-.51 2.906-.754.038-.01.083.015.147.028a36.3 36.3 0 0 1-1.276 6.37c-.568 1.9-1.276 3.74-2.295 5.449-.771 1.294-1.664 2.49-2.86 3.437-2.213 1.754-4.749 1.79-6.983.066-1.491-1.15-2.536-2.659-3.396-4.308-1.448-2.778-2.302-5.75-2.801-8.824-.258-1.594-.393-3.209-.548-4.817-.038-.389-.23-.414-.524-.43-2.542-.144-5.033-.556-7.406-1.513-1.645-.664-3.159-1.548-4.251-2.99-1.496-1.971-1.568-4.108-.61-6.322.88-2.028 2.326-3.623 3.977-5.04 2.968-2.55 6.382-4.334 10.004-5.754.025-.01.057-.001.148-.001" fill="#1e6292"/></g>
      </svg>
    )
  }
  if (taskName.includes("移动")) {
    return (
      <svg viewBox="0 0 46 46" width="24" height="24" aria-hidden="true">
        <path d="M43.848 28.039c-3.782-5.117-9.441-10.338-10.99-11.688C31.794 15.416 30.652 15 29.586 15s-2.132.493-3.045 1.273a7.5 7.5 0 0 1-.736.675c-2.233 1.948-9.187 8.494-9.365 8.675a2.88 2.88 0 0 1-1.98.831c-.659 0-1.395-.337-2.13-1.012-.483-.494-2.869-2.442-5.66-5.637a87 87 0 0 1-3.122-3.688s-.33.675-.482 1.09 0 .598.076.754c.914 1.35 5.177 6.546 10.989 11.688 1.066.935 2.208 1.351 3.274 1.351s2.131-.494 3.045-1.273c.152-.156.482-.415.736-.675 2.208-1.922 6.471-5.87 8.45-7.818.407-.416.737-.676.914-.831a2.88 2.88 0 0 1 1.98-.832c.66 0 1.396.338 2.132 1.013 1.243 1.091 3.273 3.013 5.659 5.533a87 87 0 0 1 3.121 3.688s.33-.675.483-1.169c.177-.26 0-.493-.077-.597" fill="#95c122"/><path d="M21.578 9.568C19.598 10.939 11.548 18.27 10 20.04c0 0 1.143 1.221 2.793 2.568.406.399.99.324 1.396-.15 3.123-3.067 9.446-8.552 10.258-9.2 2.387-2.02 5.18-2.17 7.719-.325C38.336 17.447 43.82 24.63 44.734 26c0 0 .152-.648.254-1.222 0 0 .076-.573-.152-1.047-5.84-8.229-11.985-13.315-14.371-14.587-2.565-1.346-5.764-1.845-8.887.424" fill="#0e84c7"/><path d="M15.263 5.307C11.383 8.494 6.302 13.249 5 14.64c0 0 .976 1.24 2.428 2.706.325.253.576.152.901-.076 3.88-3.768 8.085-7.689 10.513-9.586 4.13-3.186 8.911-3.515 13.692.253 1.778 1.391 3.33 2.782 5.582 5.16C41.02 16.284 42.897 18.99 45 22c0 0 0-.81-.25-1.872a1.5 1.5 0 0 0-.25-.733c-.401-.81-2.279-3.996-4.932-7.107-5.256-6.222-8.585-8.094-10.763-9.232-2.754-1.492-8.26-1.922-13.542 2.25m10.184 31.18C27.423 35.12 35.455 27.808 37 26.042c0 0-1.14-1.218-2.787-2.56-.405-.399-.988-.324-1.393.148-3.192 2.984-9.501 8.455-10.312 9.077-2.381 2.014-5.168 2.163-7.702.323C8.65 28.529 3.178 21.368 2.266 20c0 0-.152.646-.254 1.218 0 0-.076.572.152 1.045 5.827 8.206 11.958 13.278 14.34 14.546 2.71 1.443 5.827 1.84 8.943-.323" fill="#0e84c7"/><path d="M31.693 40.64c3.887-3.182 9.003-7.93 10.307-9.318 0 0-.978-1.237-2.433-2.701-.326-.253-.576-.152-.802.075-3.887 3.763-8.1 7.676-10.533 9.545-4.138 3.181-8.928 3.51-13.718-.253-1.78-1.388-3.335-2.777-5.592-5.15C5.962 29.705 4.107 27.004 2 24c0 0 0 .732.25 1.869.076.151.076.48.252.732.4.808 2.282 3.99 4.94 7.196 5.267 6.211 8.602 8.08 10.784 9.216 2.758 1.389 8.35 1.869 13.467-2.373" fill="#0e84c7"/>
      </svg>
    )
  }
  if (taskName.includes("内网")) {
    return (
      <svg viewBox="0 0 46 46" width="24" height="24" aria-hidden="true">
        <path d="M23 4 42 19v21a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V19L23 4z" fill="#22c55e" />
        <path d="M18 42V30a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12H18z" fill="#166534" />
      </svg>
    )
  }
  if (taskName.includes("联通")) {
    return (
      <svg viewBox="0 0 46 46" width="24" height="24" aria-hidden="true">
        <g fill="#e50017"><path d="M33.685 14.235c1.15-2.094.943-4.28-.668-6.558-2.393-1.933-4.81-2.301-7.202-1.174L22.96 9.265l-2.99-2.647c-1.91-1.196-4.142-.966-6.673.69-2.117 2.21-2.462 4.488-1.036 6.858l2.83-1.864c-.322-.828-.207-1.541.323-2.232.483-.69 1.426-.828 2.83-.368l2.025 1.818-2.048 2.209 2.439 2.485 2.324-2.232 2.232 2.209 2.785-2.624-2.255-1.956 1.633-1.887q1.934-1.035 2.831 0c.76.621.943 1.473.46 2.554l-7.8 8.054-7.778-8.03-2.854 1.863 8.215 8.676-8.283 8.744c-1.312 2.025-1.082 4.349.759 6.926 2.508 1.933 4.81 2.14 6.972.621l2.992-2.646 2.83 2.577c2.67 1.404 5.085 1.058 7.203-1.035l-2.716-1.75c-.943.438-1.91.37-2.923-.206l-1.68-1.887 2.256-1.956-2.762-2.623-2.255 2.209-2.3-2.232-2.463 2.485 2.095 2.209-2.048 1.818c-1.312.69-2.255.713-2.9.138-.759-.644-.874-1.588-.253-2.762l7.778-8.053 7.87 7.961c.667 1.197.483 2.163-.415 2.9l2.715 1.748c1.75-1.748 1.956-3.935.668-6.512l-8.146-8.582z"/><path d="m34.835 20.356-2.715-2.693-2.578 2.716 2.716 2.623-2.462 2.508 2.37 2.762 2.784-2.762 2.716-2.508-.047-.069c.53-1.105 1.427-1.68 2.67-1.749 1.311.139 1.978.76 2.025 1.75.069.966-.599 1.587-2.025 1.863-1.22-.23-2.117-.851-2.647-1.795l-2.715 2.508c1.91 2.025 3.659 3.037 5.178 2.992 3.129-.138 5.016-1.473 5.614-4.096.69-2.278.115-4.234-1.818-5.868-2.3-1.588-4.763-1.588-7.34-.023zm-18.316-.093-2.6-2.715-2.716 2.67-1.749-1.819c-2.577-1.542-5.04-1.542-7.34.023-1.91 1.611-2.531 3.59-1.841 5.869.62 2.623 2.508 3.957 5.637 4.096l-.184-3.728c-1.427-.276-2.094-.898-2.025-1.864.046-.99.69-1.61 2.025-1.749 1.22.07 2.048.69 2.393 1.818l.046.092c-.345.852-1.173 1.45-2.439 1.68l.184 3.728c1.542.023 3.268-.967 5.224-2.992l2.784 2.762 2.37-2.762-2.485-2.485z"/></g>
      </svg>
    )
  }
  return null
}

function TaskProbeRow({
  summary,
  returnLine,
  accentIds,
  showPacketLoss,
  onSelect,
  onPress,
}: {
  summary: HomeLatencyTaskSummary
  returnLine: string
  accentIds: readonly string[]
  showPacketLoss: boolean
  onSelect?: (taskId: string) => void
  onPress?: () => void
}) {
  const { t } = useTranslation()
  const latency = formatProbeLatency(summary.latency)
  const delayTone = latencyBarTone(summary.latency)
  const packetLoss = formatProbePacketLoss(summary.packetLoss)
  const percent = hourPacketFillPercent(summary)
  const lossLabel = t("serverCard.packetLoss")
  const latencyLabel = latency.unit ? `${latency.value} ${latency.unit}` : latency.value
  const returnLabel = returnLine ? t("serverCard.returnRouteTag", { line: returnLine }) : ""
  const returnQuality = returnLine ? returnLineQuality(returnLine) : null
  const title = [
    summary.taskName,
    returnLabel,
    latencyLabel,
    showPacketLoss ? `${lossLabel} ${packetLoss}` : "",
    t("serverCard.sampleFill", { percent: percent.toFixed(0) }),
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <button
      type="button"
      title={title}
      data-accent={probeAccentIndex(summary.taskId, accentIds)}
      data-return={returnLine ? "true" : "false"}
      data-loss={showPacketLoss ? "true" : "false"}
      onPointerDown={() => onPress?.()}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.stopPropagation()
        if (event.key === " ") event.preventDefault()
      }}
      onClick={(event) => {
        if (!onSelect) return
        event.stopPropagation()
        onSelect(summary.taskId)
      }}
      className="lite-probe-row"
    >
      <span className="lite-probe-row__main">
        <span className="lite-probe-row__main-group">
          {operatorLogo(summary.taskName) ? (
            <span className="lite-probe-row__logo" aria-hidden="true">{operatorLogo(summary.taskName)}</span>
          ) : null}
          <span className="lite-probe-row__name" title={summary.taskName}>{summary.taskName}</span>
          {returnLine && returnQuality ? (
            <span className="lite-probe-row__return" data-quality={returnQuality} title={returnLabel}>
              <span className="lite-probe-row__return-dot" aria-hidden="true" />
              <span className="lite-probe-row__return-text">{returnLine}</span>
            </span>
          ) : null}
        </span>
      </span>
      <span className="lite-probe-row__viz">
        <span className="lite-probe-row__viz-top">
          <span className="lite-probe-row__viz-delay">
            <b className="tabular-nums" data-tone={delayTone}>{latency.value}</b>
            {latency.unit ? <small>{latency.unit}</small> : null}
          </span>
          {showPacketLoss ? (
            <span className="lite-probe-row__viz-loss" title={`${lossLabel} ${packetLoss}`}>
              <b className="tabular-nums">{packetLoss}</b>
            </span>
          ) : null}
        </span>
        <ProbeHistoryStrip
          latency={summary.latencyHistory}
          loss={summary.packetLossHistory}
          label={`${summary.taskName} ${t("serverCard.latency")} ${latencyLabel}`}
        />
      </span>
    </button>
  )
}

export default function ServerLatencySummary({
  summaries,
  returnRoute,
  onSelectTask,
  onPrefetch,
}: {
  summaries?: HomeLatencyTaskSummary[]
  returnRoute?: PublicReturnRoute
  onSelectTask?: (taskId: string) => void
  onPrefetch?: (priority: boolean) => void
}) {
  const { t } = useTranslation()
  const showReturnRoute = readShowHomeReturnRoute()
  const showPacketLoss = readShowHomePacketLoss()
  const displayed = (summaries || []).slice(0, HOME_LATENCY_CARD_LIMIT)
  const accentIds = displayed.map((item) => item.taskId)
  const returnLines = displayed.map((item) => (showReturnRoute ? returnLineForPingTask(returnRoute, item.taskId) : ""))
  const hasAnyReturn = returnLines.some(Boolean)
  const sectionRef = useRef<HTMLElement>(null)
  const prefetchRef = useRef(onPrefetch)
  prefetchRef.current = onPrefetch

  useEffect(() => {
    const node = sectionRef.current
    if (!node) return

    let dwell: number | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.5) {
          dwell = window.setTimeout(() => prefetchRef.current?.(false), 300)
          return
        }
        if (dwell !== undefined) {
          window.clearTimeout(dwell)
          dwell = undefined
        }
      },
      { threshold: [0.5] },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      if (dwell !== undefined) window.clearTimeout(dwell)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      onPointerEnter={() => onPrefetch?.(true)}
      className="lite-server-card__quality"
      data-testid="server-latency-summary"
    >
      <div className="lite-server-card__quality-title">
        <h3>
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="1" y="11" width="3" height="4" rx="1" />
            <rect x="5" y="8" width="3" height="7" rx="1" />
            <rect x="9" y="5" width="3" height="10" rx="1" />
            <rect x="13" y="2" width="3" height="13" rx="1" />
          </svg>
          {t("serverCard.networkQuality")}
        </h3>
        <span>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.5V8l2.5 1.5" />
          </svg>
          {t("serverCard.recentHour")}
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </span>
      </div>
      {displayed.length > 0 ? (
        <div
          className="lite-server-card__probes"
          data-count={displayed.length}
          data-loss={showPacketLoss ? "true" : "false"}
          data-return={hasAnyReturn ? "true" : "false"}
        >
          {displayed.map((item, index) => (
            <TaskProbeRow
              key={item.taskId}
              summary={item}
              returnLine={returnLines[index] || ""}
              accentIds={accentIds}
              showPacketLoss={showPacketLoss}
              onSelect={onSelectTask}
              onPress={() => onPrefetch?.(true)}
            />
          ))}
        </div>
      ) : (
        <div className="grid place-items-center py-3 text-center text-[11px] leading-snug text-[var(--card-muted)]">
          {t("monitor.noData")}
        </div>
      )}
    </section>
  )
}
