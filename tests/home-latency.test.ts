import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  HOME_CARD_WIDTH,
  HOME_FIVE_COL_WIDTH,
  HOME_FOUR_COL_WIDTH,
  HOME_LATENCY_CARD_LIMIT,
  HOME_TWO_COL_WIDTH,
  formatProbeLatency,
  formatProbePacketLoss,
  homeCardColumnCount,
  homeCardTrackWidth,
  homePageMaxWidth,
  homeProbeRowCount,
  homeProbeShouldStack,
  hourPacketFillPercent,
  latencyBarTone,
  lossBarTone,
  mapPingStatsToHomeLatency,
  probeStripBarHeight,
  probeStripBarTone,
  readHomeLatencyCache,
  summarizeHomeLatencySamples,
  writeHomeLatencyCache,
} from "../src/lib/home-latency.ts"

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

function sample(taskId: string, timestamp: number, latency: number | null, lossRatio: number, count: number) {
  return { entityId: "node-a", taskId, taskName: `Task ${taskId}`, timestamp, latency, lossRatio, count }
}

test("restores recent per-task latency values during a page refresh", () => {
  const storage = memoryStorage()
  const summary = {
    taskId: "1",
    taskName: "Shanghai",
    latency: 32,
    packetLoss: 1.5,
    latencyHistory: [30, 32],
    packetLossHistory: [0, 3],
    updatedAt: 120_000,
  }

  writeHomeLatencyCache(storage, { "node-a": [summary] }, 200_000)
  assert.deepEqual(readHomeLatencyCache(storage, ["node-a"], 210_000), { "node-a": [summary] })
})

test("ignores stale or unrelated latency cache entries", () => {
  const storage = memoryStorage()
  const summary = {
    taskId: "1",
    taskName: "Shanghai",
    latency: 32,
    packetLoss: 0,
    latencyHistory: [32],
    packetLossHistory: [0],
    updatedAt: 120_000,
  }

  writeHomeLatencyCache(storage, { "node-a": [summary] }, 200_000)
  assert.equal(readHomeLatencyCache(storage, ["node-b"], 210_000), undefined)
  assert.equal(readHomeLatencyCache(storage, ["node-a"], 200_000 + 5 * 60_000 + 1), undefined)
})

test("keeps every ping task as a separate weighted summary", () => {
  const bucket = 2 * 60_000
  const result = summarizeHomeLatencySamples(
    [sample("1", bucket, 20, 0, 10), sample("1", bucket, 40, 0.1, 10), sample("1", bucket * 2, 35, 0, 20), sample("2", bucket * 2, 80, 0, 5)],
    2,
  )

  assert.equal(result["node-a"].length, 2)
  const first = result["node-a"].find((item) => item.taskId === "1")!
  const second = result["node-a"].find((item) => item.taskId === "2")!
  assert.ok(Math.abs((first.latencyHistory[0] || 0) - 560 / 19) < 0.0001)
  assert.equal(first.packetLossHistory[0], 5)
  assert.equal(first.latency, 35)
  assert.equal(first.packetLoss, 2.5)
  assert.equal(second.latency, 80)
  assert.equal(second.taskName, "Task 2")
})

test("keeps each task timeline continuous when records skip intervals", () => {
  const bucket = 2 * 60_000
  const result = summarizeHomeLatencySamples([sample("1", bucket, 20, 1, 1), sample("1", bucket * 3, 30, 0, 1)], 3)["node-a"][0]

  assert.deepEqual(result.latencyHistory, [null, null, 30])
  assert.deepEqual(result.packetLossHistory, [100, null, 0])
  assert.equal(result.packetLoss, 50)
})

test("weights a task loss rate by probe count", () => {
  const bucket = 2 * 60_000
  const result = summarizeHomeLatencySamples([sample("1", bucket, null, 1, 2), sample("1", bucket * 2, 25, 0, 18)], 2)["node-a"][0]

  assert.equal(result.packetLoss, 10)
  assert.deepEqual(result.packetLossHistory, [100, 0])
})

test("keeps total packet loss visible without inventing latency", () => {
  const result = summarizeHomeLatencySamples([sample("1", 60_000, null, 1, 12)])["node-a"][0]
  assert.equal(result.latency, null)
  assert.equal(result.packetLoss, 100)
})

test("formats probe packet loss with one decimal", () => {
  assert.equal(formatProbePacketLoss(null), "—")
  assert.equal(formatProbePacketLoss(-1), "—")
  assert.equal(formatProbePacketLoss(0), "0.0%")
  assert.equal(formatProbePacketLoss(1.54), "1.5%")
  assert.equal(formatProbePacketLoss(100), "100.0%")
})

test("formats probe latency without turning 0 into missing", () => {
  assert.deepEqual(formatProbeLatency(null), { value: "—", unit: null })
  assert.deepEqual(formatProbeLatency(-1), { value: "—", unit: null })
  assert.deepEqual(formatProbeLatency(0), { value: "0.00", unit: "ms" })
  assert.deepEqual(formatProbeLatency(135.21), { value: "135.21", unit: "ms" })
})

test("fills the probe bar from last-hour reply rate, not expected ping count", () => {
  assert.equal(hourPacketFillPercent({}), 0)
  assert.equal(hourPacketFillPercent({ packetLoss: 0 }), 0)
  assert.equal(hourPacketFillPercent({ packetLoss: 25 }), 0)
  assert.equal(hourPacketFillPercent({ total: 0, valid: 0, packetLoss: 0 }), 0)
  assert.equal(hourPacketFillPercent({ total: 60, valid: 60 }), 100)
  assert.equal(hourPacketFillPercent({ total: 60, valid: 57, packetLoss: 5 }), 95)
  assert.equal(hourPacketFillPercent({ total: 12, valid: 12, interval: 60 }), 100)
  assert.equal(hourPacketFillPercent({ total: 15, valid: 15, packetLoss: 0 }), 100)
})

test("colors 0-80ms green, 80-180ms amber, and 180ms+ coral", () => {
  assert.equal(latencyBarTone(null), "empty")
  assert.equal(latencyBarTone(-4), "empty")
  assert.equal(latencyBarTone(0), "green")
  assert.equal(latencyBarTone(13), "green")
  assert.equal(latencyBarTone(80), "green")
  assert.equal(latencyBarTone(80.1), "amber")
  assert.equal(latencyBarTone(135), "amber")
  assert.equal(latencyBarTone(179.9), "amber")
  assert.equal(latencyBarTone(180), "coral")
  assert.equal(latencyBarTone(200), "coral")
})

test("colors packet loss green at 0%, amber below 5%, and coral at 5%+", () => {
  assert.equal(lossBarTone(null), "empty")
  assert.equal(lossBarTone(-1), "empty")
  assert.equal(lossBarTone(0), "green")
  assert.equal(lossBarTone(0.1), "amber")
  assert.equal(lossBarTone(4.9), "amber")
  assert.equal(lossBarTone(5), "coral")
  assert.equal(lossBarTone(51.7), "coral")
})

test("homepage probe rows render latency and packet-loss history strips", () => {
  const summary = readFileSync(new URL("../src/components/ServerLatencySummary.tsx", import.meta.url), "utf8")
  assert.match(summary, /ProbeHistoryStrip/)
  assert.doesNotMatch(summary, /LatencyHistoryBars/)
  assert.doesNotMatch(summary, /PacketLossHistoryBars/)
  assert.match(summary, /packetLossHistory/)
  const strip = readFileSync(new URL("../src/components/ProbeHistoryStrip.tsx", import.meta.url), "utf8")
  assert.match(strip, /probeStripBarTone/)
  assert.match(strip, /probeStripBarHeight/)
})

test("combined probe strip: loss turns the bar purple, height follows latency", () => {
  // Any packet loss gets its own purple tone so it never reads as high
  // latency: a 160ms bucket with loss is "loss", not coral.
  assert.equal(probeStripBarTone(160, 2.1), "loss")
  assert.equal(probeStripBarTone(13, 0.1), "loss")
  // No loss: the latency tone decides.
  assert.equal(probeStripBarTone(160, 0), "amber")
  assert.equal(probeStripBarTone(13, 0), "green")
  assert.equal(probeStripBarTone(200, 0), "coral")
  assert.equal(probeStripBarTone(null, 0), "empty")
  assert.equal(probeStripBarTone(null, null), "empty")
  // Height scales with latency (200ms = full 16px), 2px minimum.
  assert.equal(probeStripBarHeight(null), 2)
  assert.equal(probeStripBarHeight(-4), 2)
  assert.equal(probeStripBarHeight(1.32), 2)
  assert.equal(probeStripBarHeight(80), 6)
  assert.equal(probeStripBarHeight(160), 13)
  assert.equal(probeStripBarHeight(200), 16)
  assert.equal(probeStripBarHeight(400), 16)
})

test("maps ping metric stats onto per-task home summaries", () => {
  const result = mapPingStatsToHomeLatency(
    [
      { entity_id: "node-a", task_id: "2", name: "Tokyo", latest: 80, loss: 0 },
      { entity_id: "node-a", task_id: "1", latest: 32, avg: 40, loss: 1.5 },
    ],
    [
      { id: 1, name: "Shanghai" },
      { id: 2, name: "Tokyo" },
    ],
  )

  assert.equal(result["node-a"].length, 2)
  assert.equal(result["node-a"][0].taskName, "Shanghai")
  assert.equal(result["node-a"][0].latency, 32)
  assert.equal(result["node-a"][1].taskName, "Tokyo")
})

test("pads ping-stat histories to the full 30-dot window with the latest sample last", () => {
  const result = mapPingStatsToHomeLatency([{ entity_id: "node-a", task_id: "1", name: "Shanghai", latest: 42, loss: 2 }])
  const summary = result["node-a"][0]
  assert.equal(summary.latencyHistory.length, 30)
  assert.deepEqual(summary.latencyHistory.slice(0, 29), Array(29).fill(null))
  assert.equal(summary.latencyHistory[29], 42)
  assert.equal(summary.packetLossHistory.length, 30)
  assert.deepEqual(summary.packetLossHistory.slice(0, 29), Array(29).fill(null))
  assert.equal(summary.packetLossHistory[29], 2)
})

test("treats zero-sample ping stats as empty instead of a full green bar", () => {
  const result = mapPingStatsToHomeLatency([{ entity_id: "node-a", task_id: "1", name: "Fujian", latest: null, loss: 0, total: 0, valid: 0 }])
  assert.equal(result["node-a"][0].latency, null)
  assert.equal(result["node-a"][0].packetLoss, null)
  assert.equal(hourPacketFillPercent(result["node-a"][0]), 0)
})

test("homepage cards keep at most four probe tasks", () => {
  assert.equal(HOME_LATENCY_CARD_LIMIT, 4)
})

test("homepage probes render as Komari-style rows with a latency history strip", () => {
  const latency = readFileSync(new URL("../src/components/ServerLatencySummary.tsx", import.meta.url), "utf8")
  const bars = readFileSync(new URL("../src/components/ProbeHistoryStrip.tsx", import.meta.url), "utf8")
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  const card = readFileSync(new URL("../src/components/ServerCard.tsx", import.meta.url), "utf8")
  const home = readFileSync(new URL("../src/pages/Server.tsx", import.meta.url), "utf8")
  assert.match(latency, /slice\(0, HOME_LATENCY_CARD_LIMIT\)/)
  assert.match(latency, /lite-probe-row/)
  assert.match(latency, /ProbeHistoryStrip/)
  assert.match(latency, /data-count=\{displayed.length\}/)
  assert.match(latency, /probeAccentIndex/)
  assert.match(latency, /latencyBarTone/)
  assert.match(latency, /lite-probe-row__return/)
  assert.match(latency, /lite-probe-row__viz-delay/)
  assert.match(latency, /lite-probe-row__viz-loss/)
  assert.match(bars, /probeStripBarTone/)
  assert.match(bars, /lite-probe-strip/)
  assert.match(bars, /lite-probe-strip__bar/)
  assert.match(bars, /data-tone=\{tone\}/)
  assert.match(css, /data-tone="green"/)
  assert.doesNotMatch(latency, /lite-probe-chip/)
  assert.doesNotMatch(latency, /grid-cols-2|stackProbes|col-span-2/)
  assert.doesNotMatch(latency, /homeLatencyGridTemplate|home-latency-cols/)
  assert.doesNotMatch(css, /lite-probe-chip/)
  assert.doesNotMatch(css, /grid-template-rows:\s*subgrid/)
  assert.match(css, /\.lite-server-card__probes \{[\s\S]*?display:\s*flex/)
  assert.match(css, /\.lite-server-card__probes \{[\s\S]*?flex-direction:\s*column/)
  assert.match(css, /\.lite-probe-row \{[\s\S]*?border-bottom:\s*1px dashed rgba\(148, 163, 184, 0\.55\)/)
  assert.doesNotMatch(css, /\.lite-probe-row:last-child \{[\s\S]*?border-bottom:\s*0/)
  assert.match(css, /\.lite-probe-strip \{[\s\S]*?display:\s*flex/)
  assert.match(css, /\.lite-probe-strip__bar\[data-tone="green"\] \{[\s\S]*?background:\s*var\(--card-green\)/)
  assert.match(css, /\.lite-probe-strip__bar\[data-tone="amber"\] \{[\s\S]*?background:\s*var\(--card-amber\)/)
  assert.match(css, /\.lite-probe-strip__bar\[data-tone="coral"\] \{[\s\S]*?background:\s*var\(--card-danger\)/)
  assert.match(css, /\.lite-probe-strip__bar\[data-tone="loss"\] \{[\s\S]*?background:\s*#a855f7/)
  assert.match(css, /\.lite-probe-row__viz-delay b\[data-tone="green"\] \{[\s\S]*?color:\s*var\(--card-green\)/)
  assert.match(css, /\.lite-probe-row__viz-delay b\[data-tone="coral"\] \{[\s\S]*?color:\s*var\(--card-danger\)/)
  // Probe rows stack the name and return tag: the name and the tag are
  // both a fixed 64px wide, text centered in each, so the two form one
  // uniform column and read as a single unit. The row has a fixed height
  // of 39px. The gap to the viz is a uniform 8px on every row. The viz
  // fills the rest.
  assert.match(css, /\.lite-probe-row__main \{[\s\S]*?flex:\s*0 0 64px/)
  assert.match(css, /\.lite-probe-row__main \{[\s\S]*?width:\s*64px/)
  assert.match(css, /\.lite-probe-row__main \{[\s\S]*?flex-direction:\s*column/)
  assert.match(css, /\.lite-probe-row__main \{[\s\S]*?align-items:\s*center/)
  assert.match(css, /\.lite-probe-row__main \{[\s\S]*?min-height:\s*34px/)
  assert.doesNotMatch(css, /\.lite-probe-row__main \{[^}]*border-radius:/)
  assert.doesNotMatch(css, /\.lite-probe-row__main \{[^}]*background:/)
  assert.match(css, /\.lite-probe-row__main-group \{[\s\S]*?flex-direction:\s*column/)
  assert.match(css, /\.lite-probe-row__main-group \{[\s\S]*?align-items:\s*center/)
  assert.match(css, /\.lite-probe-row__name \{[\s\S]*?width:\s*64px/)
  assert.match(css, /\.lite-probe-row__name \{[\s\S]*?text-align:\s*center/)
  assert.match(css, /\.lite-probe-row__return \{[\s\S]*?width:\s*56px/)
  assert.match(css, /\.lite-probe-row__return \{[\s\S]*?padding:\s*1px 0/)
  assert.match(css, /\.lite-probe-row__name \{[\s\S]*?font-size:\s*14px/)
  // The name follows the card text color, so it stays readable in both
  // modes: white on a dark card, dark on a light card.
  assert.match(css, /\.lite-probe-row__name \{[\s\S]*?color:\s*var\(--card-text\)/)
  // The capsule has no glow and its fill follows the text color, a
  // lighter tint of it (the text color at low opacity), so the pill
  // reads in both modes.
  assert.match(css, /\.lite-probe-row__return\[data-quality="premium"\] \{[\s\S]*?background:\s*linear-gradient\(120deg, #d2ab4f 0%, #e2c15c 30%, #fdf3c4 50%, #e2c15c 70%, #d2ab4f 100%\)/)
  assert.match(css, /\.lite-probe-row__return\[data-quality="optimized"\] \{[\s\S]*?background:\s*linear-gradient\(120deg, #1d4ed8 0%, #3b82f6 30%, #dbeafe 50%, #3b82f6 70%, #1d4ed8 100%\)/)
  assert.match(css, /\.lite-probe-row__return\[data-quality="internal"\] \{[\s\S]*?background:\s*rgba\(22, 101, 52, 0\.15\)/)
  assert.match(css, /html\.dark \.lite-probe-row__main \.lite-probe-row__return\[data-quality="premium"\] \{[\s\S]*?background:\s*linear-gradient\(120deg, #c49c38 0%, #f3c923 30%, #fef6c0 50%, #f3c923 70%, #c49c38 100%\)/)
  assert.match(css, /html\.dark \.lite-probe-row__main \.lite-probe-row__return\[data-quality="optimized"\] \{[\s\S]*?background:\s*linear-gradient\(120deg, #1e40af 0%, #3b82f6 30%, #bfdbfe 50%, #3b82f6 70%, #1e40af 100%\)/)
  assert.match(css, /html\.dark \.lite-probe-row__main \.lite-probe-row__return\[data-quality="internal"\] \{[\s\S]*?background:\s*rgba\(21, 128, 61, 0\.22\)/)
  assert.doesNotMatch(css, /\.lite-probe-row__return \{[^}]*box-shadow:/)
  assert.doesNotMatch(css, /\.lite-probe-row__return \{[^}]*linear-gradient\(90deg, #a855f7/)
  assert.match(css, /\.lite-probe-row__return \{[\s\S]*?text-align:\s*center/)
  // Adaptive inside the box: the viz takes whatever width the row leaves
  // (flex: 1, min-width: 0) and stacks a numbers line over one combined
  // strip — so the strip always fills its width and nothing can ever
  // spill past the box. No fixed pixel width is pinned anywhere in the viz.
  assert.match(css, /\.lite-probe-row__viz \{[\s\S]*?flex:\s*1 1 0/)
  assert.match(css, /\.lite-probe-row__viz \{[\s\S]*?min-width:\s*0/)
  assert.match(css, /\.lite-probe-row__viz \{[\s\S]*?flex-direction:\s*column/)
  assert.match(css, /\.lite-probe-row__viz \{[\s\S]*?gap:\s*3px/)
  assert.doesNotMatch(css, /\.lite-probe-row__viz \{[^}]*width:\s*\d+px/)
  assert.doesNotMatch(css, /\.lite-probe-row\[data-loss="false"\] \.lite-probe-row__viz \{/)
  // Numbers sit on one line above the strip: the viz is a column (nums
  // row over one bars row), not a row of two columns.
  assert.match(css, /\.lite-probe-row__viz-top \{[\s\S]*?display:\s*flex/)
  assert.match(css, /\.lite-probe-row__viz-top \{[\s\S]*?justify-content:\s*flex-end/)
  assert.match(css, /\.lite-probe-row__viz-top \{[\s\S]*?gap:\s*10px/)
  assert.doesNotMatch(css, /\.lite-probe-row__viz-col \{/)
  assert.doesNotMatch(css, /\.lite-latency-bars \{/)
  assert.doesNotMatch(css, /\.lite-probe-row__viz-delay \{[^}]*flex:\s*1 1 0/)
  assert.doesNotMatch(css, /\.lite-probe-row__viz-loss \{[^}]*flex:\s*1 1 0/)
  assert.doesNotMatch(css, /\.lite-probe-row__viz-nums \{/)
  assert.doesNotMatch(css, /\.lite-probe-row__viz-bars \{/)
  assert.match(css, /\.lite-probe-strip \{[\s\S]*?display:\s*flex/)
  assert.match(css, /\.lite-probe-strip \{[\s\S]*?height:\s*16px/)
  assert.match(css, /\.lite-probe-strip \{[\s\S]*?align-items:\s*flex-end/)
  assert.match(css, /\.lite-probe-strip \{[\s\S]*?gap:\s*2px/)
  // One combined strip: bars flex to fill the width (no fixed 1px width),
  // heights vary with the latency value (inline style), so the strip reads
  // as one even row whose skyline shows the latency trend.
  assert.doesNotMatch(css, /\.lite-probe-strip \{[^}]*justify-content:\s*space-between/)
  assert.doesNotMatch(css, /\.lite-probe-strip \{[^}]*display:\s*grid/)
  assert.match(css, /\.lite-probe-strip__bar \{[\s\S]*?flex:\s*1 1 0/)
  assert.match(css, /\.lite-probe-strip__bar \{[\s\S]*?min-width:\s*0/)
  assert.doesNotMatch(css, /\.lite-probe-strip__bar \{[^}]*width:\s*1px/)
  assert.doesNotMatch(css, /\.lite-probe-strip__bar \{[^}]*aspect-ratio:/)
  assert.doesNotMatch(css, /\.lite-probe-strip__bar \{[^}]*max-width:/)
  // Return-route tag is bold in Chinese only (en/ja keep regular weight).
  assert.match(css, /html\[lang="zh-CN"\] \.lite-probe-row__return,[\s\S]*?font-weight:\s*700/)
  assert.match(css, /html\[lang="zh-TW"\] \.lite-probe-row__return \{[\s\S]*?font-weight:\s*700/)
  // No fixed width tiers remain.
  assert.doesNotMatch(css, /flex-basis:\s*(290|264|244|222|197|177|139|127|115|107|95|82)px/)
  // Card bottom: traffic and billing are two separate rounded sub-cards
  // stacked with a gap, no single top border on the container. Traffic is
  // the original horizontal progress bar; the fill color follows the usage
  // tone.
  assert.match(css, /\.lite-server-card__bottom \{[\s\S]*?flex-direction:\s*column/)
  assert.match(css, /\.lite-server-card__traffic-card \{[\s\S]*?border:\s*1px solid var\(--card-inset-border\)/)
  assert.match(css, /\.lite-server-card__traffic-card \{[\s\S]*?border-radius:\s*16px/)
  // 3D: every content sub-card is raised with a drop shadow plus a top
  // highlight, and the numbers and bars inside carry the depth too.
  assert.match(css, /\.lite-server-card__resources \{[\s\S]*?box-shadow:\s*var\(--card-inset-shadow\)/)
  assert.match(css, /\.lite-server-card__quality \{[\s\S]*?box-shadow:\s*var\(--card-inset-shadow\)/)
  assert.match(css, /\.lite-server-card__traffic-card \{[\s\S]*?box-shadow:\s*var\(--card-inset-shadow\)/)
  assert.match(css, /\.lite-server-card__footer \{[\s\S]*?box-shadow:\s*var\(--card-inset-shadow\)/)
  assert.match(css, /\.lite-server-card__net-cell \{[\s\S]*?box-shadow:\s*var\(--card-inset-shadow\)/)
  assert.match(css, /\.lite-server-card__speed \{[\s\S]*?text-shadow:\s*var\(--card-num-shadow\)/)
  assert.match(css, /\.lite-server-card__resource-value \{[\s\S]*?text-shadow:\s*var\(--card-num-shadow\)/)
  // Dark mode 3D reads stronger: the drop shadow is deeper and the top
  // highlight brighter, since black-on-black barely shows.
  assert.match(css, /html\.dark \.lite-server-card \{[\s\S]*?--card-inset-shadow:\s*0 20px 44px rgba\(0, 0, 0, 0\.80\), 0 6px 16px rgba\(0, 0, 0, 0\.70\), inset 0 1px 0 rgba\(255, 255, 255, 0\.30\), inset 0 -1px 0 rgba\(0, 0, 0, 0\.40\)/)
  assert.match(css, /html\.dark \.lite-server-card \{[\s\S]*?--card-num-shadow:\s*0 4px 10px rgba\(0, 0, 0, 0\.85\)/)
  assert.match(css, /html\.dark \.lite-server-card__meter,[\s\S]*?box-shadow:\s*inset 0 2px 5px rgba\(0, 0, 0, 0\.60\)/)
  assert.match(css, /\.lite-server-card__meter \{[\s\S]*?box-shadow:\s*inset 0 2px 4px rgba\(0, 0, 0, 0\.30\)/)
  assert.match(css, /\.lite-server-card__quota-meter \{[\s\S]*?box-shadow:\s*inset 0 2px 4px rgba\(0, 0, 0, 0\.30\)/)
  // The empty part of a progress bar (the track) is a solid bar with a
  // clear outline, so the bar's full length reads at a glance.
  assert.match(css, /\.lite-server-card__meter \{[\s\S]*?background:\s*var\(--card-track\)/)
  assert.match(css, /\.lite-server-card \{[\s\S]*?--card-track:\s*#dbe2ec/)
  assert.match(css, /html\.dark \.lite-server-card \{[\s\S]*?--card-track:\s*#475569/)
  // Country flag and OS logo float with a drop shadow, so they read as
  // raised emblems instead of flat print.
  assert.match(css, /\.lite-server-card__flag \{[\s\S]*?filter:\s*var\(--card-icon-shadow\)/)
  assert.match(css, /\.lite-server-card__os-badge svg \{[\s\S]*?filter:\s*var\(--card-icon-shadow\)/)
  // VPS name and online-duration pill carry the depth too, with a
  // stronger two-layer shadow so the header row reads clearly raised.
  // (VPS name shadow removed 2026-11-20 at the user's request; the
  // duration pill numbers keep theirs.)
  assert.doesNotMatch(css, /\.lite-server-card__name \{[^}]*text-shadow:/)
  // Metal gradient name (v1.3.10 look, one shade darker since the
  // 2026-11-23 chrome revert): dark steel by day, solid white by night
  // (white since 2026-11-23 at the user's request).
  assert.match(css, /\.lite-server-card__name \{[^}]*background:\s*linear-gradient\(180deg, #475569 0%, #0f172a 55%, #020617 100%\)/)
  assert.match(css, /html\.dark \.lite-server-card__name \{[^}]*-webkit-text-fill-color:\s*#ffffff/)
  assert.match(css, /\.lite-duration-pill \{[\s\S]*?box-shadow:\s*0 4px 10px rgba\(0, 0, 0, 0\.38\), 0 1px 3px rgba\(0, 0, 0, 0\.30\), inset 0 1px 0 rgba\(255, 255, 255, 0\.45\), inset 0 -1px 0 rgba\(0, 0, 0, 0\.12\)/)
  assert.match(css, /\.lite-duration-pill__num \{[\s\S]*?text-shadow:\s*var\(--card-name-shadow\)/)
  assert.doesNotMatch(css, /\.lite-server-card__bottom \{[^}]*border-top:\s*1px solid var\(--card-line\)/)
  assert.match(css, /\.lite-server-card__quota-meter \{[\s\S]*?height:\s*5px/)
  assert.match(css, /\.lite-server-card__fill--traffic \{[\s\S]*?background:\s*var\(--card-traffic\)/)
  assert.match(css, /\.lite-server-card__fill--danger \{[\s\S]*?background:\s*var\(--card-danger\)/)
  // The fill glows in its own color (a lit strip) so the bar reads
  // clearly at its original height.
  assert.match(css, /\.lite-server-card__fill--accent \{[\s\S]*?filter:\s*drop-shadow\(0 0 4px var\(--card-accent\)\)/)
  assert.match(css, /\.lite-server-card__fill--traffic \{[\s\S]*?filter:\s*drop-shadow\(0 0 4px var\(--card-traffic\)\)/)
  assert.match(css, /\.lite-server-card__fill--amber \{[\s\S]*?filter:\s*drop-shadow\(0 0 4px var\(--card-amber\)\)/)
  assert.match(css, /\.lite-server-card__fill--danger \{[\s\S]*?filter:\s*drop-shadow\(0 0 4px var\(--card-danger\)\)/)
  assert.doesNotMatch(css, /\.lite-server-card__donut/)
  assert.doesNotMatch(css, /\.lite-server-card__quota \{[^}]*border-top:\s*1px solid var\(--card-line\)/)
  assert.match(css, /\.lite-server-card__quality \{[\s\S]*flex:\s*1 1 auto/)
  assert.match(card, /h-full/)
  assert.match(home, /items-stretch/)
  assert.doesNotMatch(css, /\.lite-server-card__bottom \{[\s\S]*?margin-top:\s*auto/)
})

test("homepage card columns follow the server grid breakpoints", () => {
  assert.equal(homeCardColumnCount(967), 1)
  assert.equal(homeCardColumnCount(968), 2)
  assert.equal(homeCardColumnCount(1439), 2)
  assert.equal(homeCardColumnCount(1440), 4)
  assert.equal(homeCardColumnCount(1919), 4)
  assert.equal(homeCardColumnCount(1920), 5)
  assert.equal(homePageMaxWidth(1), null)
  assert.equal(homePageMaxWidth(2), HOME_TWO_COL_WIDTH)
  assert.equal(homePageMaxWidth(4), HOME_FOUR_COL_WIDTH)
  assert.equal(homePageMaxWidth(5), HOME_FIVE_COL_WIDTH)
  assert.equal(homeCardTrackWidth(1), null)
  assert.equal(homeCardTrackWidth(2), HOME_TWO_COL_WIDTH - 56)
  assert.equal(homeCardTrackWidth(4), HOME_FOUR_COL_WIDTH - 56)
  assert.equal(homeCardTrackWidth(4), HOME_CARD_WIDTH * 4 + 48)
  assert.equal(homeCardTrackWidth(5), HOME_FIVE_COL_WIDTH - 80)
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  assert.match(css, /max-w-\[1920px\].*max-\[1919px\]:max-w-\[1680px\].*max-\[1439px\]:max-w-\[1120px\]/)
  const home = readFileSync(new URL("../src/pages/Server.tsx", import.meta.url), "utf8")
  assert.match(home, /repeat\(\$\{cardColumns\}, minmax\(0, 1fr\)\)/)
})

test("two-task probes stack to one per row when a neighbor in the same row already has two probe rows", () => {
  assert.equal(homeProbeRowCount(0), 0)
  assert.equal(homeProbeRowCount(1), 1)
  assert.equal(homeProbeRowCount(2), 1)
  assert.equal(homeProbeRowCount(3), 2)
  assert.equal(homeProbeRowCount(4), 2)
  assert.equal(homeProbeRowCount(9), 2)

  const mixed = [2, 2, 2, 4]
  assert.equal(homeProbeShouldStack(mixed, 0, 4), true)
  assert.equal(homeProbeShouldStack(mixed, 1, 4), true)
  assert.equal(homeProbeShouldStack(mixed, 2, 4), true)
  assert.equal(homeProbeShouldStack(mixed, 3, 4), false)

  const even = [2, 2, 2, 2]
  assert.equal(homeProbeShouldStack(even, 0, 4), false)
  assert.equal(homeProbeShouldStack(even, 3, 4), false)

  const nextRow = [2, 2, 2, 2, 4]
  assert.equal(homeProbeShouldStack(nextRow, 0, 4), false)
  assert.equal(homeProbeShouldStack(nextRow, 4, 4), false)

  const threeCol = [2, 4, 2]
  assert.equal(homeProbeShouldStack(threeCol, 0, 3), true)
  assert.equal(homeProbeShouldStack(threeCol, 2, 3), true)

  assert.equal(homeProbeShouldStack([2, 4], 0, 1), false)
  assert.equal(homeProbeShouldStack([1, 4], 0, 4), false)
})
