import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const footer = readFileSync(new URL("../src/components/Footer.tsx", import.meta.url), "utf8")
const serverPage = readFileSync(new URL("../src/pages/Server.tsx", import.meta.url), "utf8")
const groupSwitch = readFileSync(new URL("../src/components/GroupSwitch.tsx", import.meta.url), "utf8")
const languageSwitcher = readFileSync(new URL("../src/components/LanguageSwitcher.tsx", import.meta.url), "utf8")
const i18n = readFileSync(new URL("../src/i18n.ts", import.meta.url), "utf8")
const theme = readFileSync(new URL("../src/theme/createLiteTheme.ts", import.meta.url), "utf8")
const websocket = readFileSync(new URL("../src/context/websocket-provider.tsx", import.meta.url), "utf8")
const liteApi = readFileSync(new URL("../src/lib/lite-api.ts", import.meta.url), "utf8")
const themeHomeSort = readFileSync(new URL("../src/lib/theme-home-sort.ts", import.meta.url), "utf8")

test("limits public languages to Chinese, English and Japanese", () => {
  assert.match(languageSwitcher, /"zh-CN"/)
  assert.match(languageSwitcher, /"zh-TW"/)
  assert.match(languageSwitcher, /"en-US"/)
  assert.match(languageSwitcher, /"ja-JP"/)
  assert.doesNotMatch(languageSwitcher, /ru-RU|es-ES|de-DE|ta-IN/)
  assert.match(i18n, /ja-JP/)
  assert.doesNotMatch(i18n, /ru-RU|es-ES|de-DE|ta-IN/)
})

test("loads only the current public language until the language menu is opened", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8")
  const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8")
  assert.doesNotMatch(i18n, /import enTranslation from/)
  assert.doesNotMatch(i18n, /import zhCNTranslation from/)
  assert.match(i18n, /import\("\.\/locales\/zh-CN\/translation\.json"\)/)
  assert.match(i18n, /import\("\.\/locales\/zh-TW\/translation\.json"\)/)
  assert.match(i18n, /import\("\.\/locales\/en\/translation\.json"\)/)
  assert.match(i18n, /import\("\.\/locales\/ja\/translation\.json"\)/)
  assert.match(i18n, /export function preloadPublicLocales/)
  assert.match(i18n, /export async function changePublicLanguage/)
  assert.match(i18n, /load: "currentOnly"/)
  assert.match(main, /i18nReady/)
  assert.match(languageSwitcher, /preloadPublicLocales\(\)/)
  assert.match(languageSwitcher, /changePublicLanguage\(code\)/)
  assert.match(app, /readStoredLanguage\(\)/)
  assert.match(app, /changePublicLanguage\(lng, \{ persist: false \}\)/)
})

test("hides homepage sort, version and Ctrl+K", () => {
  const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8")
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8")
  assert.doesNotMatch(serverPage, /defaultSort/)
  assert.match(serverPage, /readThemeHomeSort/)
  assert.doesNotMatch(footer, /Ctrl|⌘|V1\.0\.0|themeBy/)
  assert.match(footer, /Powered by Lite/)
  assert.match(footer, /mt-3/)
  assert.doesNotMatch(footer, /pt-7|pb-3 pt-3/)
  assert.doesNotMatch(main, /CommandProvider|SortProvider|TooltipProvider|sonner/)
  assert.doesNotMatch(index, /flag-icons|font-logos/)
  assert.equal(existsSync(new URL("../src/lib/geo-json-string.ts", import.meta.url)), false)
  assert.equal(existsSync(new URL("../src/lib/geo-limit.ts", import.meta.url)), false)
  assert.equal(existsSync(new URL("../src/components/ui/command.tsx", import.meta.url)), false)
  assert.equal(existsSync(new URL("../public/animated-man.webp", import.meta.url)), false)
  assert.equal(existsSync(new URL("../src/components/Icon.tsx", import.meta.url)), false)
})

test("uses brand blue and nested group radii", () => {
  const brand = readFileSync(new URL("../src/theme/brand.ts", import.meta.url), "utf8")
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  assert.match(brand, /#078DEE/)
  assert.match(brand, /PAGE_LIGHT = "#F4F6F8"/)
  assert.match(brand, /PAPER_LIGHT = "#FFFFFF"/)
  assert.match(css, /background-color: #f4f6f8/)
  assert.match(css, /--lite-paper: #ffffff/)
  assert.match(theme, /LITE_BLUE/)
  assert.match(theme, /paper: isLight \? PAPER_LIGHT : PAPER_DARK/)
  assert.match(groupSwitch, /const GROUP_RADIUS_PX = 8/)
  assert.match(groupSwitch, /const GROUP_INNER_RADIUS_PX = GROUP_RADIUS_PX - GROUP_PADDING_PX/)
})

test("homepage uses a card-style status overview with a light health gradient", () => {
  const overview = readFileSync(new URL("../src/components/ServerOverview.tsx", import.meta.url), "utf8")
  assert.match(overview, /lite-home-overview/)
  assert.match(overview, /lite-home-greeting-name/)
  assert.match(overview, /serverOverview.liveBandwidth/)
  assert.match(overview, /setStatus\(status === "online" \? "all" : "online"\)/)
  assert.match(overview, /setStatus\(status === "offline" \? "all" : "offline"\)/)
  assert.doesNotMatch(overview, /SYSTEM HEALTH/)
  assert.doesNotMatch(overview, /conic-gradient/)
  assert.doesNotMatch(overview, /healthStatusDots/)
  assert.doesNotMatch(overview, /QuickMetric/)
  assert.doesNotMatch(overview, /TrafficMini/)
  assert.match(overview, /readShowMobileHomeOverview/)
  assert.match(overview, /home-mobile-metrics/)
  assert.match(overview, /home-mobile-flow/)
  assert.doesNotMatch(overview, /OverviewPane/)
  assert.doesNotMatch(overview, /axisSpeedTicks/)
  assert.doesNotMatch(overview, /slice\(0, 32\)/)
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  assert.match(css, /\.lite-home-overview__live \.lite-home-chart \{[\s\S]*flex: 1 1 auto/)
  assert.match(css, /\.lite-home-overview__live \.lite-home-chart__svg \{[\s\S]*min-height: 72px/)
  assert.match(css, /\.lite-home-overview__layout \{[\s\S]*?gap: 12px/)
  assert.match(css, /\.lite-home-overview__live \{[\s\S]*?padding: 14px 16px/)
  // Mobile metric numbers are 17px (not 23px): the widest max value
  // ("999.99 M/s", 72px) must fit a 360px phone tile (75px of room),
  // and 17px is the point where shrinking stops narrowing the text.
  // Tiles use 10px side padding and the sub-line is 8px for the same reason.
  assert.match(css, /\.lite-home-overview__metrics \.lite-home-measure \{[\s\S]*?font-size:\s*17px/)
  assert.match(css, /\.lite-home-overview--mobile-open \.lite-home-overview__metrics > article \{[\s\S]*?padding: 10px 10px/)
  assert.match(css, /\.lite-home-overview__metrics p \{[\s\S]*?font-size:\s*8px/)
})

test("homepage overview renders as raised 3D sub-cards like the server cards", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  assert.match(css, /\.lite-home-overview \{[\s\S]*?--home-bg: #dde5eb/)
  assert.match(css, /\.lite-home-overview \{[\s\S]*?--home-inset: #ffffff/)
  assert.match(css, /\.lite-home-overview \{[\s\S]*?background: var\(--home-bg\)/)
  assert.match(css, /\.lite-home-overview \{[\s\S]*?box-shadow: var\(--home-inset-shadow\)/)
  assert.match(css, /html\.dark \.lite-home-overview \{[\s\S]*?--home-bg: #232f3f/)
  assert.match(css, /html\.dark \.lite-home-overview \{[\s\S]*?--home-inset: #131e2b/)
  assert.match(css, /\.lite-home-overview \.lite-home-measure \{[\s\S]*?text-shadow: var\(--home-num-shadow\)/)
  assert.match(css, /\.lite-home-overview__desk-head \{[\s\S]*?background: var\(--home-inset\)/)
  assert.match(css, /\.lite-home-overview__desk-head \{[\s\S]*?box-shadow: var\(--home-inset-shadow\)/)
  assert.match(css, /\.lite-home-overview__layout \{[\s\S]*?gap: 16px/)
  assert.match(css, /\.lite-home-overview__live \{[\s\S]*?background: var\(--home-inset\)/)
  assert.match(css, /\.lite-home-overview__stats \{[\s\S]*?background: var\(--home-inset\)/)
  assert.match(css, /\.lite-home-overview__stats \{[\s\S]*?box-shadow: var\(--home-inset-shadow\)/)
  assert.doesNotMatch(css, /\.lite-home-overview__stats \{[\s\S]*?border-left: 1px solid var\(--home-line\)/)
  assert.match(css, /\.lite-home-overview--mobile-open \.lite-home-overview__metrics > article \{[\s\S]*?background: var\(--home-inset\)/)
  assert.match(css, /\.lite-home-overview__flow \{[\s\S]*?background: var\(--home-inset\)/)
  assert.match(css, /\.lite-home-greeting-name \{[\s\S]*?-webkit-text-fill-color: transparent/)
})

test("server detail panels render as raised 3D cards like the server cards", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  assert.match(css, /\.lite-panel \{[\s\S]*?--detail-inset: #ffffff/)
  assert.match(css, /\.lite-panel \{[\s\S]*?--detail-inset-border: #d5dfe8/)
  assert.match(css, /\.lite-panel \{[\s\S]*?border: 1px solid var\(--detail-inset-border\)/)
  assert.match(css, /\.lite-panel \{[\s\S]*?background: var\(--detail-inset\)/)
  assert.match(css, /\.lite-panel \{[\s\S]*?box-shadow: var\(--detail-inset-shadow\)/)
  assert.match(css, /html\.dark \.lite-panel \{[\s\S]*?--detail-inset: #131e2b/)
  assert.match(css, /html\.dark \.lite-panel \{[\s\S]*?--detail-inset-border: #1d2a3a/)
  assert.match(css, /\.lite-resource-metric__top b \{[\s\S]*?text-shadow: var\(--detail-num-shadow\)/)
  assert.match(css, /\.lite-speed-measure \{[\s\S]*?text-shadow: var\(--detail-num-shadow\)/)
  assert.match(css, /\.lite-monitor-summary__metrics strong \{[\s\S]*?text-shadow: var\(--detail-num-shadow\)/)
  assert.match(css, /\.lite-task-chips__item,[\s\S]*?\.lite-task-chips__more \{[\s\S]*?background: linear-gradient\(180deg, rgba\(255, 255, 255, 0\.14\) 0%, var\(--detail-inset\) 55%, rgba\(0, 0, 0, 0\.08\) 100%\);/)
  assert.match(css, /\.lite-task-chips__item,[\s\S]*?\.lite-task-chips__more \{[\s\S]*?box-shadow: 0 2px 5px rgba\(0, 0, 0, 0\.18\), inset 0 1px 0 rgba\(255, 255, 255, 0\.28\);/)
  assert.match(css, /\.lite-task-chips__item\.is-active \{[\s\S]*?background: color-mix\(in srgb, #078dee 8%, var\(--detail-inset\)\)/)
  assert.match(css, /\.lite-monitor-summary__choose \{[\s\S]*?background: var\(--detail-inset\)/)
  assert.doesNotMatch(css, /\[data-testid="network-chart-card"\][\s\S]*?--detail-inset: transparent;/)
  assert.match(css, /html\.dark \{[\s\S]*?background-color: transparent;[\s\S]*?body \{[\s\S]*?background-color: transparent;/)
  assert.match(css, /\.lite-panel \{[\s\S]*?--detail-inset-shadow: inset 0 1px 0 rgba\(255, 255, 255, 0\.85\), inset 0 -1px 0 rgba\(31, 52, 71, 0\.08\);/)
  assert.match(css, /html\.dark \.lite-panel \{[\s\S]*?--detail-inset-shadow: inset 0 1px 0 rgba\(255, 255, 255, 0\.3\), inset 0 -1px 0 rgba\(0, 0, 0, 0\.4\);/)
})

test("homepage latency probes keep latency and packet loss in one compact metric group", () => {
  const latency = readFileSync(new URL("../src/components/ServerLatencySummary.tsx", import.meta.url), "utf8")
  const bars = readFileSync(new URL("../src/components/ProbeHistoryStrip.tsx", import.meta.url), "utf8")
  const card = readFileSync(new URL("../src/components/ServerCard.tsx", import.meta.url), "utf8")
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  const planInfo = readFileSync(new URL("../src/components/PlanInfo.tsx", import.meta.url), "utf8")
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8")
  assert.match(latency, /formatProbePacketLoss/)
  assert.match(latency, /formatProbeLatency/)
  assert.match(latency, /serverCard.packetLoss/)
  assert.match(latency, /hourPacketFillPercent/)
  assert.doesNotMatch(latency, /lite-server-card__packet-meter/)
  assert.match(latency, /lite-probe-row/)
  assert.match(latency, /lite-probe-row__viz-delay/)
  assert.match(latency, /lite-probe-row__viz-top/)
  assert.doesNotMatch(latency, /lite-probe-row__viz-col/)
  assert.match(latency, /ProbeHistoryStrip/)
  assert.match(bars, /lite-probe-strip/)
  assert.match(bars, /lite-probe-strip__bar/)
  assert.match(latency, /stopPropagation/)
  assert.doesNotMatch(latency, /probe-loss-label/)
  assert.match(css, /container-type: inline-size/)
  assert.doesNotMatch(css, /mask-image: repeating-linear-gradient/)
  // Compact card: section gaps are 8px (the safe minimum: any smaller and
  // the rounded sub-cards start to read as one merged block).
  assert.match(css, /\.lite-server-card__body \{[\s\S]*?gap:\s*8px/)
  assert.match(css, /\.lite-server-card__bottom \{[\s\S]*?gap:\s*8px/)
  // Card bottom: traffic and billing are two separate rounded sub-cards
  // stacked with a gap. Traffic is back to the original horizontal
  // progress bar (usage line + 5px bar + used/reset line), no donut,
  // no divider, no remaining-traffic block.
  assert.match(css, /\.lite-server-card__bottom \{[\s\S]*?flex-direction:\s*column/)
  assert.doesNotMatch(css, /\.lite-server-card__bottom \{[^}]*border-top:\s*1px solid var\(--card-line\)/)
  assert.match(css, /\.lite-server-card__traffic-card \{[\s\S]*?border:\s*1px solid var\(--card-inset-border\)/)
  assert.match(css, /\.lite-server-card__traffic-card \{[\s\S]*?border-radius:\s*12px/)
  assert.match(css, /\.lite-server-card__footer \{[\s\S]*?border:\s*1px solid var\(--card-inset-border\)/)
  assert.match(css, /\.lite-server-card__footer \{[\s\S]*?border-radius:\s*12px/)
  // Billing remaining days and balance stack vertically (two lines),
  // not side by side on one line.
  assert.match(css, /\.lite-server-card__footer-remain \{[\s\S]*?flex-direction:\s*column/)
  assert.match(css, /\.lite-server-card__quota-meter \{[\s\S]*?height:\s*5px/)
  assert.match(css, /\.lite-server-card__quota-meter \{[\s\S]*?background:\s*var\(--card-track\)/)
  assert.match(css, /\.lite-server-card__quota-percent \{[\s\S]*?margin-left:\s*auto/)
  assert.doesNotMatch(css, /\.lite-server-card__donut/)
  assert.doesNotMatch(css, /\.lite-server-card__quota-divider/)
  assert.doesNotMatch(css, /\.lite-server-card__quota-remain/)
  assert.doesNotMatch(css, /\.lite-server-card__quota-info/)
  assert.doesNotMatch(css, /\.lite-server-card__quota \{[^}]*border-top:\s*1px solid var\(--card-line\)/)
  // Redesigned card: gradient glow border on the frame, online status as
  // Card keeps the original frame: a left-edge 2px status strip, full
  // brightness (same solid green/red as before, only narrower). No status
  // dot next to the name.
  assert.doesNotMatch(css, /\.lite-server-card__frame \{[\s\S]*?background:\s*linear-gradient\(135deg, #22e6c8/)
  assert.match(css, /\.lite-server-card__frame \{[\s\S]*?border-left:\s*2px solid #22c55e/)
  assert.doesNotMatch(css, /\.lite-server-card__status-dot/)
  assert.doesNotMatch(card, /lite-server-card__status-dot/)
  // Upload/download are two separate rounded sub-cards, one content per
  // block, no sparkline.
  assert.match(css, /\.lite-server-card__net \{[\s\S]*?display:\s*flex/)
  assert.match(css, /\.lite-server-card__net-cell \{[\s\S]*?border:\s*1px solid var\(--card-inset-border\)/)
  assert.match(css, /\.lite-server-card__net-cell \{[\s\S]*?border-radius:\s*12px/)
  // Light mode: the card itself is a soft grey-blue so the white sub-cards
  // (net cells, resources, quality, traffic, footer) read as raised panels.
  assert.match(css, /\.lite-server-card \{[\s\S]*?--card-bg:\s*#dde5eb/)
  assert.match(css, /\.lite-server-card \{[\s\S]*?--card-inset:\s*#ffffff/)
  assert.match(css, /html\.dark \.lite-server-card \{[\s\S]*?--card-bg:\s*#232f3f/)
  assert.match(css, /html\.dark \.lite-server-card \{[\s\S]*?--card-inset:\s*#131e2b/)
  // Night B (2026-11-23): keep the dark sub-cards, strengthen the 3D
  // separation instead — brighter inset border and top highlight.
  assert.match(css, /html\.dark \.lite-server-card \{[\s\S]*?--card-inset-border:\s*#1d2a3a/)
  assert.match(css, /html\.dark \.lite-server-card \{[\s\S]*?--card-inset-shadow:\s*0 20px 44px rgba\(0, 0, 0, 0\.80\), 0 6px 16px rgba\(0, 0, 0, 0\.70\), inset 0 1px 0 rgba\(255, 255, 255, 0\.30\), inset 0 -1px 0 rgba\(0, 0, 0, 0\.40\)/)
  // Scheme C label colors reverted to the pre-C defaults on 2026-11-23:
  // labels read --card-secondary, totals read --card-muted; the night-only
  // 11px label size was removed the same day so day and night label sizes
  // match (rate 12px, resource 12.5px, quota 11.5px, quality 13.5px).
  assert.doesNotMatch(css, /#7d90a5/)
  assert.doesNotMatch(css, /#6b7f93/)
  assert.match(css, /\.lite-server-card__net-cell \.lite-server-card__speed \{[\s\S]*?font-size:\s*clamp\(22px, 7\.2cqi, 28px\)/)
  // Bandwidth gauge: bold 270° dial (bottom opening) with the needle
  // reaching the dial, matching the reference badge (2026-11-23).
  assert.match(card, /M5\.64 18\.36A9 9 0 1 1 18\.36 18\.36/)
  assert.match(card, /M12 12\.5 17\.8 5\.6/)
  assert.match(card, /strokeWidth="3"/)
  assert.doesNotMatch(css, /\.lite-server-card__rates \{/)
  assert.doesNotMatch(css, /\.lite-server-card__spark/)
  // Redesigned card: CPU / memory / storage / load in one rounded sub-card
  // of four columns.
  assert.match(css, /\.lite-server-card__resources \{[\s\S]*?grid-template-columns:\s*repeat\(4, 1fr\)/)
  assert.match(css, /\.lite-server-card__resources \{[\s\S]*?border:\s*1px solid var\(--card-inset-border\)/)
  assert.match(css, /\.lite-server-card__resources \{[\s\S]*?border-radius:\s*12px/)
  assert.doesNotMatch(css, /\.lite-server-card__resources \{[^}]*border-bottom:\s*1px solid var\(--card-line\)/)
  // Probes: stacked rows with latency and loss history strips, inside
  // one rounded sub-card (the old dashed frame around the rows is gone).
  assert.match(css, /\.lite-server-card__quality \{[\s\S]*?border:\s*1px solid var\(--card-inset-border\)/)
  assert.match(css, /\.lite-server-card__quality \{[\s\S]*?border-radius:\s*12px/)
  assert.doesNotMatch(css, /\.lite-server-card__probes \{[\s\S]*?border:\s*1px dashed/)
  assert.doesNotMatch(latency, /flex-col items-end/)
  assert.doesNotMatch(latency, /稳定/)
  assert.doesNotMatch(latency, /y1="21"|polyline|sparklinePoints|grid-cols-3/)
  assert.doesNotMatch(latency, /homeLatencyGridTemplate/)
  assert.match(latency, /HOME_LATENCY_CARD_LIMIT/)
  assert.match(latency, /slice\(0, HOME_LATENCY_CARD_LIMIT\)/)
  assert.doesNotMatch(latency, /grid-cols-2/)
  assert.doesNotMatch(latency, /stackProbes/)
  assert.match(latency, /probeAccentIndex/)
  assert.doesNotMatch(latency, /packetFillTone/)
  assert.match(css, /\.lite-server-card__probes \{[\s\S]*?flex-direction:\s*column/)
  assert.match(css, /\.lite-probe-row \{[\s\S]*?border-bottom:\s*1px dashed rgba\(148, 163, 184, 0\.55\)/)
  assert.match(css, /align-items: baseline/)
  assert.match(css, /#159C82/)
  assert.match(css, /#347DDF/)
  assert.match(css, /#8264D5/)
  assert.match(css, /#D45C87/)
  assert.match(card, /RESOURCE_SWATCH/)
  assert.match(card, /splitFormattedMeasure/)
  assert.match(card, /lite-server-card__hero/)
  assert.match(card, /loadUsagePercent/)
  assert.doesNotMatch(card, /stackLatencyProbes/)
  assert.doesNotMatch(card, /serverCard\.tcp|tcp_conn/)
  assert.doesNotMatch(latency, /packetLoss \?\? 0\) >= 5/)
  assert.doesNotMatch(planInfo, /regionTag/)
  assert.doesNotMatch(planInfo, /country_code/)
  assert.doesNotMatch(planInfo, /networkRoute/)
  assert.match(card, /lite-server-card__footer/)
  assert.match(card, /lite-server-card__bottom/)
  // Resource numbers are 18px: the widest max value ("100.0 %") fits a
  // 360px phone card column because the cells use 2px side padding
  // (below); the blocks share one fixed 12px gap (the body flex gap),
  // with no per-block margin on top.
  assert.match(css, /\.lite-server-card__resource-value \{[\s\S]*?font-size:\s*18px/)
  assert.match(css, /\.lite-server-card__body \{[\s\S]*?gap:\s*12px/)
  // Narrow cards (<=399px): the four resource cells use 2px side padding
  // (not 5px), so the widest max value ("100.0 %", ~64px at 18px) gets
  // ~5px of slack in a 360px phone column instead of overflowing.
  assert.match(css, /@container server-card \(max-width: 399px\) \{[\s\S]*?\.lite-server-card__resource \{[\s\S]*?padding:\s*0 2px/)
  assert.doesNotMatch(css, /\.lite-server-card__quality \{[^}]*margin-top:/)
  assert.doesNotMatch(css, /\.lite-server-card__bottom \{[^}]*margin-top:/)
  // Traffic and billing sit inside the body, so they share the body's
  // 18px side inset and are exactly as wide as the blocks above them.
  const bodyOpen = card.indexOf('lite-server-card__body')
  const bottomOpen = card.indexOf('lite-server-card__bottom')
  const bodyClose = card.lastIndexOf('</div>', card.indexOf('</article>'))
  assert.ok(bodyOpen !== -1 && bottomOpen > bodyOpen && bottomOpen < bodyClose)
  assert.match(card, /shouldShowHomeProbeWindow/)
  assert.doesNotMatch(card, /overflow-hidden/)
  assert.match(card, /lite-server-card/)
  assert.doesNotMatch(card, /border-b border-\[var\(--lite-line\)\]/)
  assert.match(css, /html\.dark \.lite-server-card\[data-online="true"\]:hover/)
  assert.match(css, /\.lite-server-card\[data-online="true"\]:hover,/)
  assert.match(css, /\.lite-server-card\[data-online="false"\]:hover,/)
  // Hover glow follows the server status: online light green, offline
  // light red, never blue.
  assert.match(css, /0 0 10px rgba\(34, 197, 94, 0\.18\)/)
  assert.match(css, /0 0 10px rgba\(255, 86, 48, 0\.18\)/)
  assert.match(css, /0 0 12px rgba\(34, 197, 94, 0\.26\)/)
  assert.match(css, /0 0 12px rgba\(255, 86, 48, 0\.26\)/)
  assert.doesNotMatch(css, /0 0 10px rgba\(7, 141, 238, 0\.34\)/)
  assert.doesNotMatch(css, /0 0 12px rgba\(88, 179, 255, 0\.48\)/)
  assert.doesNotMatch(css, /\.lite-server-card:hover \.lite-server-card__frame/)
  assert.doesNotMatch(css, /\.lite-server-card::before/)
  assert.doesNotMatch(css, /0 0 0 1px rgba\(7, 141, 238/)
  assert.doesNotMatch(css, /0 0 16px 2px/)
  assert.doesNotMatch(css, /0 0 72px 18px/)
  assert.doesNotMatch(planInfo, /trafficVol/)
  assert.doesNotMatch(planInfo, /bandwidth/)
  assert.match(planInfo, /extraList/)
  assert.doesNotMatch(app, /PageTransition/)
})

test("header and page body share the same content shell", () => {
  const header = readFileSync(new URL("../src/components/Header.tsx", import.meta.url), "utf8")
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8")
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  assert.match(css, /lite-page-shell/)
  assert.match(css, /max-w-\[1920px\]/)
  assert.match(css, /--lite-header-height: 64px/)
  assert.match(css, /scrollbar-gutter: stable/)
  assert.match(header, /lite-page-shell/)
  assert.match(header, /fixed inset-x-0 top-0/)
  assert.match(app, /lite-page-shell/)
  assert.match(app, /h-\[calc\(var\(--lite-header-height\)\+var\(--safe-area-top\)\)\]/)
  assert.doesNotMatch(header, /max-w-\[1420px\]/)
  assert.doesNotMatch(header, /liveConnection/)
})

test("restores homepage scroll after leaving a server detail page", () => {
  const header = readFileSync(new URL("../src/components/Header.tsx", import.meta.url), "utf8")
  const overview = readFileSync(new URL("../src/components/ServerDetailOverview.tsx", import.meta.url), "utf8")
  const serverCard = readFileSync(new URL("../src/components/ServerCard.tsx", import.meta.url), "utf8")
  assert.match(serverPage, /restoreHomeScroll\(\)/)
  assert.match(serverPage, /saveHomeScroll\(\)/)
  assert.match(serverPage, /addEventListener\("scroll"/)
  assert.match(serverCard, /saveHomeScroll\(\)/)
  assert.match(header, /clearHomeScroll\(\)/)
  assert.match(overview, /navigate\("\/"\)/)
})

test("public PWA uses cover viewport and root safe-area insets", () => {
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8")
  const header = readFileSync(new URL("../src/components/Header.tsx", import.meta.url), "utf8")
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8")
  assert.match(index, /viewport-fit=cover/)
  assert.match(index, /lite-standalone/)
  assert.match(index, /apple-mobile-web-app-status-bar-style" content="black-translucent"/)
  assert.match(index, /rel="apple-touch-icon" href="\/apple-touch-icon\.png/)
  assert.match(css, /--safe-area-top: 0px/)
  assert.match(css, /display-mode: standalone/)
  assert.match(css, /html\.lite-standalone/)
  assert.match(css, /--safe-area-top: env\(safe-area-inset-top, 0px\)/)
  assert.match(header, /pt-\[var\(--safe-area-top\)\]/)
  assert.match(header, /backdrop-blur-sm/)
  assert.match(header, /bg-white\/96/)
  assert.match(app, /var\(--safe-area-bottom\)/)
})

test("applies homepage sort from theme settings", () => {
  const detail = readFileSync(new URL("../src/components/ServerDetailOverview.tsx", import.meta.url), "utf8")
  assert.match(themeHomeSort, /HomeSortType/)
  assert.match(themeHomeSort, /HomeSortOrder/)
  assert.match(themeHomeSort, /export function compareHomeServers/)
  assert.match(serverPage, /compareHomeServers/)
  assert.match(detail, /compareHomeServers/)
  assert.match(detail, /disableScrollLock/)
  assert.match(theme, /disableScrollLock: true/)
  assert.match(serverPage, /aria-label=\{t\("home.sort"\)\}/)
  assert.match(serverPage, /flex min-w-0 items-center gap-3 max-\[967px\]:contents/)
  assert.match(serverPage, /flex items-end gap-2.5/)
  assert.match(serverPage, /text-\[11px\] leading-none text-\[#919EAB\]/)
  assert.doesNotMatch(serverPage, /top-1\.5/)
})

test("keeps public dashboard polling cheap", () => {
  assert.match(websocket, /STATUS_POLL_MS = 5000/)
  assert.match(websocket, /getLiteNodes\(false\)/)
  assert.match(websocket, /readLiveStatusCache/)
  assert.match(websocket, /writeLiveStatusCache/)
  assert.doesNotMatch(websocket, /messageHistory|HISTORY_LIMIT|needReconnect/)
  assert.match(liteApi, /public:getPingMetricStats/)
  assert.match(liteApi, /historyMaxPoints/)
  assert.match(serverPage, /refetchInterval: 5_000/)
  assert.doesNotMatch(serverPage, /homeProbeShouldStack/)
  assert.doesNotMatch(serverPage, /stackLatencyProbes/)
})

test("drops unused public-dashboard leftovers", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8")
  const header = readFileSync(new URL("../src/components/Header.tsx", import.meta.url), "utf8")
  const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8")
  const chart = readFileSync(new URL("../src/components/ui/chart.tsx", import.meta.url), "utf8")
  const sortContext = readFileSync(new URL("../src/context/sort-context.ts", import.meta.url), "utf8")
  const formatInfo = readFileSync(new URL("../src/lib/utils.ts", import.meta.url), "utf8")
  assert.doesNotMatch(app, /RefreshToast/)
  assert.doesNotMatch(header, /RefreshToast|needReconnect/)
  assert.doesNotMatch(main, /url="\/api\/v1\/ws\/server"/)
  assert.doesNotMatch(chart, /ChartLegend/)
  assert.doesNotMatch(sortContext, /createContext|SortContext/)
  assert.doesNotMatch(formatInfo, /boot_time_string|gpu_info/)
  assert.doesNotMatch(formatInfo, /export const fetcher|liteFetcher|formatRelativeTime/)
  assert.doesNotMatch(sortContext, /up total|down total/)
  assert.doesNotMatch(readFileSync(new URL("../src/lib/sparkline.ts", import.meta.url), "utf8"), /sparklinePoints|padLeft/)
  assert.doesNotMatch(readFileSync(new URL("../src/lib/region.ts", import.meta.url), "utf8"), /regionTone/)
  assert.doesNotMatch(readFileSync(new URL("../src/lib/home-latency.ts", import.meta.url), "utf8"), /HOME_PAGE_MAX_WIDTH|HOME_CARD_GAP|HOME_CARD_MIN_WIDTH/)
  assert.doesNotMatch(themeHomeSort, /THEME_HOME_SORT_TYPES/)
  assert.equal(existsSync(new URL("../src/lib/theme-colors.ts", import.meta.url)), false)
  assert.equal(existsSync(new URL("../src/components/RemainPercentBar.tsx", import.meta.url)), false)
})

test("shows a loader instead of a blank page while public settings load", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8")
  const loader = readFileSync(new URL("../src/components/loading/Loader.tsx", import.meta.url), "utf8")
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  assert.match(app, /<Header \/>/)
  assert.match(app, /!settingData \? \(\s*<Loader visible \/>/)
  assert.match(app, /useLayoutEffect/)
  assert.doesNotMatch(app, /isCustomCodeInjected/)
  assert.doesNotMatch(app, /if \(!settingData\) \{\s*return null/)
  assert.doesNotMatch(app, /fullscreen/)
  assert.match(loader, /CircularProgress/)
  assert.match(loader, /size=\{44\}/)
  assert.match(loader, /#078DEE/)
  assert.match(loader, /common\.loading/)
  assert.match(loader, /flex-1/)
  assert.doesNotMatch(loader, /fullscreen/)
  assert.doesNotMatch(loader, /min-h-dvh/)
  assert.doesNotMatch(css, /hamster-loading/)
  assert.doesNotMatch(loader, /hamster-spinner/)
})

test("keeps assigned ping tasks on the public monitor even without metric points", () => {
  assert.match(liteApi, /mergeAssignedPingMonitors/)
  assert.match(liteApi, /unionPingTasksForClient/)
  assert.match(liteApi, /seedAssignedHomeLatency/)
})

test("prefetches probe charts from homepage hover, press and visibility", () => {
  const latency = readFileSync(new URL("../src/components/ServerLatencySummary.tsx", import.meta.url), "utf8")
  const card = readFileSync(new URL("../src/components/ServerCard.tsx", import.meta.url), "utf8")
  const chart = readFileSync(new URL("../src/components/NetworkChart.tsx", import.meta.url), "utf8")
  const prefetch = readFileSync(new URL("../src/lib/prefetch-monitor.ts", import.meta.url), "utf8")
  assert.match(prefetch, /prefetchQuery/)
  assert.match(prefetch, /priority/)
  assert.match(prefetch, /MAX_IDLE_PREFETCH = 1/)
  assert.match(latency, /IntersectionObserver/)
  assert.match(latency, /onPointerEnter/)
  assert.match(latency, /onPointerDown/)
  assert.match(latency, /prefetchRef\.current\?\.\(false\)/)
  assert.match(card, /prefetchServerMonitor/)
  assert.match(card, /prefetchMonitor\(true\)/)
  assert.match(chart, /monitorQueryKey/)
  assert.match(chart, /readHomeLatencyCache/)
  assert.match(chart, /waitingForChart/)
})

test("public locales share the visitor-facing copy keys", () => {
  function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
    return Object.entries(obj).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key
      return value && typeof value === "object" && !Array.isArray(value)
        ? flatten(value as Record<string, unknown>, path)
        : [path]
    })
  }
  const locales = ["zh-CN", "zh-TW", "en", "ja"]
  const trees = locales.map((locale) => JSON.parse(readFileSync(new URL(`../src/locales/${locale}/translation.json`, import.meta.url), "utf8")))
  const keys = trees.map((tree) => flatten(tree).sort())
  for (let i = 1; i < keys.length; i++) {
    assert.deepEqual(keys[i], keys[0], `${locales[i]} keys differ from zh-CN`)
  }
  for (const required of [
    "home.allServers",
    "home.serverCount",
    "serverCard.cumulative",
    "serverDetail.backToList",
    "serverOverview.runningStatus",
    "monitor.overview",
    "region.asia",
    "traffic.resetToday",
    "privateSite.title",
    "common.loading",
  ]) {
    const value = required.split(".").reduce((node: unknown, part) => (node as Record<string, unknown>)?.[part], trees[0])
    assert.equal(typeof value, "string", `zh-CN missing ${required}`)
  }
  assert.equal(keys[0].includes("map.Distributions"), false)
  assert.equal(keys[0].includes("TypeCommand"), false)
  assert.equal(keys[0].includes("serviceTracker.noService"), false)
  assert.equal(trees[0].home.liveUpdate, "数据每5S更新")
  assert.match(trees[1].home.liveUpdate, /5S/)
  assert.match(trees[2].home.liveUpdate, /5s/)
  assert.match(trees[3].home.liveUpdate, /5秒/)
})
