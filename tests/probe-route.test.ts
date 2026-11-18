import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { evaluateProbeRouteStatus, pickBestProbeTask } from "../src/lib/probe-route.ts"

const chartSource = readFileSync(new URL("../src/components/NetworkChart.tsx", import.meta.url), "utf8")

test("picks the probe with lower packet loss before lower delay", () => {
  const lowerLoss = {
    name: "YY移动",
    currentDelay: 69,
    packetLoss: 0,
    availability: 100,
    healthy: true,
  }
  const higherLoss = {
    name: "XX移动",
    currentDelay: 40,
    packetLoss: 0.6,
    availability: 99.4,
    healthy: true,
  }
  assert.equal(pickBestProbeTask([higherLoss, lowerLoss])?.name, "YY移动")
})

test("uses current delay only when packet loss is the same", () => {
  const slower = {
    name: "slow",
    currentDelay: 80,
    packetLoss: 0,
    availability: 100,
    healthy: true,
  }
  const faster = {
    name: "fast",
    currentDelay: 69,
    packetLoss: 0,
    availability: 100,
    healthy: true,
  }
  assert.equal(pickBestProbeTask([slower, faster])?.name, "fast")
})

test("route summary uses only the best single probe", () => {
  assert.match(chartSource, /pickBestProbeTask\(selectedTaskSummaries\)/)
  assert.match(chartSource, /SplitStrong value=\{overviewMetrics\.bestTask\?\.availability/)
  assert.match(chartSource, /overviewMetrics\.bestTask\?\.samples/)
  assert.doesNotMatch(chartSource, /sampleWindow.*overviewMetrics\.sampleCount/)
  assert.doesNotMatch(
    chartSource,
    /\[t\("monitor\.availability"\), formatPercentage\(overviewMetrics\.availability, 2\)\]/,
  )
  assert.match(chartSource, /evaluateProbeRouteStatus\(bestTask, selectedTaskSummaries\)/)
})

test("marks high-loss or low-availability routes as degraded instead of stable", () => {
  // Exact user bug case: 33.5% packet loss / 66.53% availability must NOT be marked stable
  const unicomDegraded = {
    name: "宁波联通",
    currentDelay: 160.36,
    averageDelay: 160.61,
    packetLoss: 33.5,
    availability: 66.53,
    healthy: true,
  }
  assert.deepEqual(evaluateProbeRouteStatus(unicomDegraded, [unicomDegraded]), {
    status: "degraded",
    tone: "coral",
  })

  const mildJitter = {
    name: "宁波移动",
    currentDelay: 131.9,
    packetLoss: 0.3,
    availability: 99.7,
    healthy: true,
  }
  assert.deepEqual(evaluateProbeRouteStatus(mildJitter, [mildJitter]), {
    status: "jitter",
    tone: "amber",
  })

  const steady = {
    name: "宁波电信",
    currentDelay: 139.21,
    packetLoss: 0,
    availability: 100,
    healthy: true,
  }
  assert.deepEqual(evaluateProbeRouteStatus(steady, [steady]), {
    status: "stable",
    tone: "green",
  })

  assert.deepEqual(evaluateProbeRouteStatus(undefined, [{ samples: 60, packetLoss: 100, availability: 0 }]), {
    status: "outage",
    tone: "coral",
  })
  assert.deepEqual(evaluateProbeRouteStatus(undefined, []), {
    status: "empty",
    tone: "muted",
  })
})
