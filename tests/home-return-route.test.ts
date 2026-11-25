import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { probeAccentIndex, probeAccentForTask } from "../src/lib/home-probe-accent.ts"
import {
  hasPublicReturnRoute,
  mapPublicReturnRoutes,
  returnLineForPingTask,
  returnLineQuality,
  returnRouteForServer,
} from "../src/lib/home-return-route.ts"

const card = readFileSync(new URL("../src/components/ServerCard.tsx", import.meta.url), "utf8")
const latency = readFileSync(new URL("../src/components/ServerLatencySummary.tsx", import.meta.url), "utf8")
const page = readFileSync(new URL("../src/pages/Server.tsx", import.meta.url), "utf8")
const api = readFileSync(new URL("../src/lib/lite-api.ts", import.meta.url), "utf8")

test("maps public return routes without private probe fields", () => {
  const mapped = mapPublicReturnRoutes([
    {
      client: "Node-A",
      lines: ["CMNET", "CMNET", "CN2 GIA"],
      tasks: [
        { ping_task_id: 11, line: "CMNET" },
        { ping_task_id: 12, line: "CN2 GIA" },
        { ping_task_id: 11, line: "CMIN2" },
      ],
      suspected_blocked: true,
      high_confidence: true,
    },
    { client: "node-b", lines: ["  "], suspected_blocked: false },
  ])
  const route = returnRouteForServer(mapped, "node-a")
  assert.deepEqual(route?.lines, ["CMNET", "CN2 GIA"])
  assert.deepEqual(route?.tasks, [
    { pingTaskId: "11", line: "CMNET" },
    { pingTaskId: "12", line: "CN2 GIA" },
  ])
  assert.equal(returnLineForPingTask(route, "12"), "CN2 GIA")
  assert.equal(returnLineForPingTask(route, "99"), "")
  assert.equal(route?.suspectedBlocked, true)
  assert.equal(route?.highConfidence, true)
  assert.equal(hasPublicReturnRoute(returnRouteForServer(mapped, "node-b")), false)
})

test("return line quality tiers: only CN2 GIA is premium", () => {
  assert.equal(returnLineQuality("CN2 GIA"), "premium")
  assert.equal(returnLineQuality("cn2 gia"), "premium")
  assert.equal(returnLineQuality("CN2 GT"), "optimized")
  assert.equal(returnLineQuality("CMIN2"), "optimized")
  assert.equal(returnLineQuality("CUG VIP"), "optimized")
  assert.equal(returnLineQuality("163"), "regular")
  assert.equal(returnLineQuality("CMI"), "regular")
  assert.equal(returnLineQuality(""), "regular")
  assert.equal(returnLineQuality("1"), "internal")
  assert.equal(returnLineQuality("内网"), "internal")
})

test("return line tier labels exist in every locale", () => {
  const expected: Record<string, Record<string, string>> = {
    "zh-CN": { premium: "精品", optimized: "优化", regular: "普通", internal: "内网" },
    "zh-TW": { premium: "精品", optimized: "優化", regular: "普通", internal: "內網" },
    en: { premium: "Premium", optimized: "Optimized", regular: "Regular", internal: "Internal" },
    ja: { premium: "プレミアム", optimized: "最適化", regular: "通常", internal: "内部ネットワーク" },
  }
  for (const [locale, labels] of Object.entries(expected)) {
    const translations = JSON.parse(readFileSync(new URL(`../src/locales/${locale}/translation.json`, import.meta.url), "utf8"))
    assert.deepEqual(translations.serverCard.returnQuality, labels)
  }
  // The tier labels stay in the locales (kept, not deleted), but the
  // return text shows the line name only — the tier is carried by the
  // data-quality attribute (dot/text color), not rendered as a word.
  assert.doesNotMatch(latency, /serverCard\.returnQuality\./)
  assert.match(latency, /data-quality=\{returnQuality\}/)
  assert.match(latency, /lite-probe-row__return-dot/)
})

test("homepage cards load public return routes onto matching ping-task rows", () => {
  assert.match(api, /public:getPublicReturnRoutes/)
  assert.match(page, /fetchPublicReturnRoutes/)
  assert.match(page, /returnRouteForServer/)
  assert.match(card, /returnRoute=\{returnRoute\}/)
  assert.match(latency, /returnLineForPingTask/)
  assert.match(latency, /lite-probe-row__return/)
  assert.doesNotMatch(latency, /reserveReturnSlot/)
  assert.match(latency, /data-return=\{hasAnyReturn \? "true" : "false"\}/)
  assert.match(latency, /probeAccentIndex\(summary.taskId, accentIds\)/)
  assert.match(latency, /serverCard.returnRouteTag/)
  assert.doesNotMatch(card, /lite-server-card__routes/)
  assert.doesNotMatch(card, /expected_line|ip_version|route_path|asn_path/)
  assert.doesNotMatch(page, /expected_line|ip_version/)
})

test("keeps probe accent colors unique among tasks on a card", () => {
  const card = ["4", "5", "9"]
  assert.equal(probeAccentIndex("4", card), 0)
  assert.equal(probeAccentIndex("5", card), 1)
  assert.equal(probeAccentIndex("9", card), 2)
  assert.notEqual(probeAccentIndex("5", card), probeAccentIndex("9", card))
  assert.equal(probeAccentIndex("5", ["9", "4", "5"]), probeAccentIndex("5", card))
  assert.equal(probeAccentIndex("1"), 0)
  assert.equal(probeAccentIndex("2"), 1)
  assert.equal(probeAccentIndex("3"), 2)
  assert.equal(probeAccentIndex("4"), 3)
  assert.equal(probeAccentForTask("1").accent, "#159C82")
  assert.equal(probeAccentForTask("2").accent, "#347DDF")
  assert.equal(probeAccentForTask("3").accent, "#8264D5")
  assert.equal(probeAccentForTask("4").accent, "#D45C87")
  assert.equal(probeAccentForTask("5", card).accent, "#347DDF")
})
