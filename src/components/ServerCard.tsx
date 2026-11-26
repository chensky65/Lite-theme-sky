import ServerFlag from "@/components/ServerFlag"
import OsLogo from "@/components/OsLogo"
import ServerLatencySummary from "@/components/ServerLatencySummary"
import TrafficBar from "@/components/TrafficBar"
import { formatBytes, formatSpeed, getStatusDurationCards, splitFormattedMeasure } from "@/lib/format"
import type { HomeLatencyTaskSummary } from "@/lib/home-latency"
import type { PublicReturnRoute } from "@/lib/home-return-route"
import { saveHomeScroll } from "@/lib/home-scroll"
import { prefetchServerMonitor } from "@/lib/prefetch-monitor"
import { loadUsagePercent } from "@/lib/meter-tone"
import { RESOURCE_SWATCH } from "@/lib/theme-tokens"
import { parseCardTags } from "@/lib/server-tags"
import { GetOsName } from "@/lib/logo-class"
import { readHideEmptyProbeWindow, readShowServerBandwidth, serverBandwidthLabel, shouldShowHomeProbeWindow } from "@/lib/theme-config"
import { calcTrafficUsed, cn, formatLiteInfo, parsePublicNote } from "@/lib/utils"
import { LiteServer } from "@/types/lite-api"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import PlanInfo from "./PlanInfo"
import BillingInfo from "./billingInfo"

function CpuIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="8" height="8" rx="1.5" />
      <path d="M6.5 1.5v2M9.5 1.5v2M6.5 12.5v2M9.5 12.5v2M1.5 6.5h2M1.5 9.5h2M12.5 6.5h2M12.5 9.5h2" />
    </svg>
  )
}

function MemoryIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="12" height="6" rx="1.5" />
      <path d="M5 7.5v1M8 7.5v1M11 7.5v1M5 2.5v1M8 2.5v1M11 2.5v1M5 12.5v1M8 12.5v1M11 12.5v1" />
    </svg>
  )
}

function StorageIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="8" cy="4" rx="5.5" ry="2.2" />
      <path d="M2.5 4v8c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V4" />
      <path d="M2.5 8c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2" />
    </svg>
  )
}

function LoadIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12.5a6.5 6.5 0 1 1 11 0" />
      <path d="M8 11.5 11 8" />
      <circle cx="8" cy="11.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ResourceMetric({ label, value, unit, percent, color, icon }: { label: string; value: string; unit?: string; percent: number; color: string; icon: React.ReactNode }) {
  const width = Math.min(100, Math.max(0, percent))
  return (
    <div className="lite-server-card__resource">
      <div className="lite-server-card__resource-label">
        <span className="lite-server-card__resource-icon" style={{ color }}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <b className="lite-server-card__resource-value tabular-nums">
        {value}
        {unit ? <small>{unit}</small> : null}
      </b>
      <div className="lite-server-card__meter" aria-hidden="true">
        <span style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  )
}

function SpeedValue({ text }: { text: string }) {
  const speed = splitFormattedMeasure(text)
  return (
    <strong className="lite-server-card__speed tabular-nums">
      {speed.value}
      <small>{speed.unit}</small>
    </strong>
  )
}

export default function ServerCard({
  now,
  serverInfo,
  latencySummaries,
  returnRoute,
}: {
  now: number
  serverInfo: LiteServer
  latencySummaries?: HomeLatencyTaskSummary[]
  returnRoute?: PublicReturnRoute
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const prefetchMonitor = useCallback(
    (priority: boolean) => prefetchServerMonitor(queryClient, serverInfo.id, { priority }),
    [queryClient, serverInfo.id],
  )
  const info = formatLiteInfo(now, serverInfo)
  // Live-ticking duration badge: the badge counts up every second like a
  // clock. Anchor on the server-reported duration and re-anchor whenever it
  // changes (new data arrives); between arrivals add wall-clock seconds
  // elapsed since the anchor, so minutes/seconds visibly advance.
  const durationAnchor = useRef({ seconds: info.statusDurationSeconds, at: Date.now() })
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    durationAnchor.current = { seconds: info.statusDurationSeconds, at: Date.now() }
  }, [info.statusDurationSeconds])
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const displayDurationSeconds =
    durationAnchor.current.seconds + Math.max(0, Math.floor((nowMs - durationAnchor.current.at) / 1000))
  const parsedData = parsePublicNote(info.public_note)
  const systemName = info.platform.includes("Windows") ? "Windows" : GetOsName(info.platform)
  const trafficUsed = calcTrafficUsed(info.net_out_transfer, info.net_in_transfer, info.traffic_limit_type)
  const bandwidth = serverBandwidthLabel(serverInfo.bandwidth)
  const showBandwidth = readShowServerBandwidth() && Boolean(bandwidth)
  const showTags = parseCardTags({ tags: serverInfo.tags, extra: parsedData?.planDataMod?.extra }).length > 0
  const showTraffic = info.traffic_limit > 0
  const showFooter = Boolean(parsedData?.billingDataMod || showTags || showBandwidth)
  const showProbeWindow = shouldShowHomeProbeWindow(latencySummaries?.length ?? 0, readHideEmptyProbeWindow())
  const openDetail = () => {
    saveHomeScroll()
    navigate(`/server/${serverInfo.id}`)
  }

  return (
    <article
      role="link"
      tabIndex={0}
      data-online={info.online ? "true" : "false"}
      data-probe-window={showProbeWindow ? "true" : "false"}
      onClick={openDetail}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        openDetail()
      }}
      className={cn("lite-server-card flex min-w-0 cursor-pointer flex-col", showProbeWindow ? "h-full" : "self-start")}
    >
      <div className="lite-server-card__frame">
        <header className="lite-server-card__hero">
          <div className="flex min-w-0 items-center gap-1">
            <ServerFlag country_code={info.country_code} className="lite-server-card__flag h-[18px] w-[26px] rounded-[3px]" />
            <span className="min-w-0">
              <strong className="lite-server-card__name block truncate" title={info.name}>{info.name}</strong>
            </span>
            <span className={cn("lite-server-card__duration ml-auto", !info.online && "lite-server-card__duration--offline")} title={info.online ? t("online") : t("offline")}>
              <span className="lite-duration-pill">
                <span className="lite-duration-pill__dot" aria-hidden="true" />
                {getStatusDurationCards(displayDurationSeconds, info.online).map((card, index) => (
                  <span key={index} className="lite-duration-pill__part">
                    <span className="lite-duration-pill__num">{card.value}</span>
                    <span className="lite-duration-pill__unit">{card.unit}</span>
                  </span>
                ))}
              </span>
            </span>
            <span className="lite-server-card__os-badge">
              <OsLogo osName={systemName} className="size-[20px]" />
            </span>
          </div>
          <div className="lite-server-card__net">
            <div className="lite-server-card__net-cell min-w-0">
              <span className="lite-server-card__rate-label lite-server-card__rate-label--up"><span>↑</span>{t("serverCard.upload")}</span>
              <SpeedValue text={formatSpeed(info.up)} />
              <span className="lite-server-card__rate-total block truncate tabular-nums">{t("serverCard.cumulative")} {formatBytes(info.net_out_transfer)}</span>
            </div>
            <div className="lite-server-card__net-cell min-w-0">
              <span className="lite-server-card__rate-label lite-server-card__rate-label--down"><span>↓</span>{t("serverCard.download")}</span>
              <SpeedValue text={formatSpeed(info.down)} />
              <span className="lite-server-card__rate-total block truncate tabular-nums">{t("serverCard.cumulative")} {formatBytes(info.net_in_transfer)}</span>
            </div>
          </div>
        </header>

        <div className="lite-server-card__body">
          <section className="lite-server-card__resources">
            <ResourceMetric label="CPU" value={info.cpu.toFixed(1)} unit="%" percent={info.cpu} color={RESOURCE_SWATCH.cpu} icon={<CpuIcon />} />
            <ResourceMetric label={t("serverCard.mem")} value={info.mem.toFixed(1)} unit="%" percent={info.mem} color={RESOURCE_SWATCH.memory} icon={<MemoryIcon />} />
            <ResourceMetric label={t("serverCard.stg")} value={info.stg.toFixed(1)} unit="%" percent={info.stg} color={RESOURCE_SWATCH.storage} icon={<StorageIcon />} />
            <ResourceMetric label={t("serverCard.load")} value={String(info.load_1)} percent={loadUsagePercent(info.load_1, info.cpu_cores)} color="var(--card-down)" icon={<LoadIcon />} />
          </section>

          {showProbeWindow ? (
            <ServerLatencySummary
              summaries={latencySummaries}
              returnRoute={returnRoute}
              onPrefetch={prefetchMonitor}
              onSelectTask={(taskId) => {
                saveHomeScroll()
                prefetchMonitor(true)
                navigate(`/server/${serverInfo.uuid || serverInfo.id}?view=network&ping_task=${encodeURIComponent(taskId)}`)
              }}
            />
          ) : null}

          {showTraffic || showFooter ? (
            <div className="lite-server-card__bottom">
              {showTraffic ? (
                <div className="lite-server-card__traffic-card">
                  <TrafficBar
                    used={trafficUsed}
                    limit={info.traffic_limit}
                    resetDay={info.traffic_reset_day}
                    resetTime={info.traffic_reset_time}
                    resetTimezone={info.traffic_reset_timezone}
                    resetAt={info.traffic_reset_at}
                    now={now}
                    limitType={info.traffic_limit_type}
                  />
                </div>
              ) : null}
              {showFooter ? (
                <footer className="lite-server-card__footer">
                  {parsedData?.billingDataMod ? (
                    <BillingInfo
                      variant="card"
                      parsedData={parsedData}
                      remainingValue={serverInfo.remaining_value}
                      remainingValueCurrency={serverInfo.remaining_value_currency}
                    />
                  ) : null}
                  {(showTags || showBandwidth) ? (
                    <div className="ml-auto flex max-w-full min-w-0 flex-wrap items-center justify-end gap-x-[11px] gap-y-1.5">
                      {showTags ? <PlanInfo parsedData={parsedData} tags={serverInfo.tags} /> : null}
                      {showBandwidth ? (
                        <span className="lite-server-card__bandwidth">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5.64 18.36A9 9 0 1 1 18.36 18.36" />
                            <path d="M12 12.5 17.8 5.6" />
                          </svg>
                          {bandwidth}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </footer>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
