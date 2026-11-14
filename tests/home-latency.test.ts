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
  const bucket = 5 * 60_000
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
  const bucket = 5 * 60_000
  const result = summarizeHomeLatencySamples([sample("1", bucket, 20, 1, 1), sample("1", bucket * 3, 30, 0, 1)], 3)["node-a"][0]

  assert.deepEqual(result.latencyHistory, [null, null, 30])
  assert.deepEqual(result.packetLossHistory, [100, null, 0])
  assert.equal(result.packetLoss, 50)
})

test("weights a task loss rate by probe count", () => {
  const bucket = 5 * 60_000
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
  assert.match(summary, /LatencyHistoryBars/)
  assert.match(summary, /PacketLossHistoryBars/)
  assert.match(summary, /packetLossHistory/)
  const bars = readFileSync(new URL("../src/components/PacketLossHistoryBars.tsx", import.meta.url), "utf8")
  assert.match(bars, /lossBarTone/)
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

test("pads ping-stat histories to the full 12-dot window with the latest sample last", () => {
  const result = mapPingStatsToHomeLatency([{ entity_id: "node-a", task_id: "1", name: "Shanghai", latest: 42, loss: 2 }])
  const summary = result["node-a"][0]
  assert.equal(summary.latencyHistory.length, 12)
  assert.deepEqual(summary.latencyHistory.slice(0, 11), Array(11).fill(null))
  assert.equal(summary.latencyHistory[11], 42)
  assert.equal(summary.packetLossHistory.length, 12)
  assert.deepEqual(summary.packetLossHistory.slice(0, 11), Array(11).fill(null))
  assert.equal(summary.packetLossHistory[11], 2)
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
  const bars = readFileSync(new URL("../src/components/LatencyHistoryBars.tsx", import.meta.url), "utf8")
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  const card = readFileSync(new URL("../src/components/ServerCard.tsx", import.meta.url), "utf8")
  const home = readFileSync(new URL("../src/pages/Server.tsx", import.meta.url), "utf8")
  assert.match(latency, /slice\(0, HOME_LATENCY_CARD_LIMIT\)/)
  assert.match(latency, /lite-probe-row/)
  assert.match(latency, /LatencyHistoryBars/)
  assert.match(latency, /data-count=\{displayed.length\}/)
  assert.match(latency, /probeAccentIndex/)
  assert.match(latency, /latencyBarTone/)
  assert.match(latency, /lite-probe-row__return/)
  assert.match(latency, /lite-probe-row__viz-delay/)
  assert.match(latency, /lite-probe-row__viz-loss/)
  assert.match(bars, /latencyBarTone/)
  assert.match(bars, /lite-latency-bars/)
  assert.match(bars, /lite-latency-bars__bar/)
  assert.match(bars, /data-tone=\{tone\}/)
  assert.match(css, /data-tone="green"/)
  assert.doesNotMatch(latency, /lite-probe-chip/)
  assert.doesNotMatch(latency, /grid-cols-2|stackProbes|col-span-2/)
  assert.doesNotMatch(latency, /homeLatencyGridTemplate|home-latency-cols/)
  assert.doesNotMatch(css, /lite-probe-chip/)
  assert.doesNotMatch(css, /grid-template-rows:\s*subgrid/)
  assert.match(css, /\.lite-server-card__probes \{[\s\S]*?display:\s*flex/)
  assert.match(css, /\.lite-server-card__probes \{[\s\S]*?flex-direction:\s*column/)
  assert.match(css, /\.lite-probe-row \{[\s\S]*?border-bottom:\s*1px solid var\(--card-line\)/)
  assert.match(css, /\.lite-probe-row:last-child \{[\s\S]*?border-bottom:\s*0/)
  assert.match(css, /\.lite-latency-bars \{[\s\S]*?display:\s*flex/)
  assert.match(css, /\.lite-latency-bars__bar\[data-tone="green"\] \{[\s\S]*?background:\s*var\(--card-green\)/)
  assert.match(css, /\.lite-latency-bars__bar\[data-tone="amber"\] \{[\s\S]*?background:\s*var\(--card-amber\)/)
  assert.match(css, /\.lite-latency-bars__bar\[data-tone="coral"\] \{[\s\S]*?background:\s*var\(--card-danger\)/)
  assert.match(css, /\.lite-probe-row__viz-delay b\[data-tone="green"\] \{[\s\S]*?color:\s*var\(--card-green\)/)
  assert.match(css, /\.lite-probe-row__viz-delay b\[data-tone="coral"\] \{[\s\S]*?color:\s*var\(--card-danger\)/)
  // Probe bars are 8px: each strip is 12 x 8px bars + 11 x 2px gaps = 118px,
  // so the two strips plus the 8px gap make the viz block 244px; the numbers
  // use the same 118px so their right edges stay aligned with the strips.
  assert.match(css, /\.lite-probe-row__viz \{[\s\S]*?flex:\s*0 0 244px/)
  assert.match(css, /\.lite-probe-row__viz-delay \{[\s\S]*?flex:\s*0 0 118px/)
  assert.match(css, /\.lite-probe-row__viz-loss \{[\s\S]*?flex:\s*0 0 118px/)
  assert.match(css, /\.lite-latency-bars__bar \{[\s\S]*?width:\s*8px/)
  // Mid-width cards (350-373px): 7px bars, each strip 12 x 7px + 11 x 2px
  // = 106px, viz block 220px, so the return route (75px) still fits.
  assert.match(css, /@container server-card \(min-width: 308px\) and \(max-width: 331px\) \{[\s\S]*?\.lite-probe-row__viz \{[\s\S]*?flex-basis:\s*220px/)
  assert.match(css, /@container server-card \(min-width: 308px\) and \(max-width: 331px\) \{[\s\S]*?\.lite-latency-bars \{[\s\S]*?flex-basis:\s*106px/)
  assert.match(css, /@container server-card \(min-width: 308px\) and \(max-width: 331px\) \{[\s\S]*?\.lite-probe-row__viz-delay \{[\s\S]*?flex-basis:\s*106px/)
  assert.match(css, /@container server-card \(min-width: 308px\) and \(max-width: 331px\) \{[\s\S]*?\.lite-probe-row__viz-loss \{[\s\S]*?flex-basis:\s*106px/)
  // Narrow cards (<=349px): each strip is 12 x 5px bars + 11 x 2px gaps = 82px,
  // so the two strips plus the 6px gap make the viz block 170px; the numbers
  // use the same 82px so their right edges stay aligned with the strips.
  assert.match(css, /@container server-card \(max-width: 307px\) \{[\s\S]*?\.lite-probe-row__viz \{[\s\S]*?flex-basis:\s*170px/)
  assert.match(css, /@container server-card \(max-width: 307px\) \{[\s\S]*?\.lite-latency-bars \{[\s\S]*?flex-basis:\s*82px/)
  assert.match(css, /@container server-card \(max-width: 307px\) \{[\s\S]*?\.lite-probe-row__viz-delay \{[\s\S]*?flex-basis:\s*82px/)
  assert.match(css, /@container server-card \(max-width: 307px\) \{[\s\S]*?\.lite-probe-row__viz-loss \{[\s\S]*?flex-basis:\s*82px/)
  assert.match(css, /\.lite-server-card__quota \{[\s\S]*?border-top:\s*1px solid var\(--card-line\)/)
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
