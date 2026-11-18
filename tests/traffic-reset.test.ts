import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { daysUntilTrafficReset } from "../src/lib/trafficReset.ts"

test("shows 0 (resetToday) only before today's scheduled reset clock, and next cycle days once reset has passed", () => {
  // Configured reset: 18th at 14:30:00 Asia/Shanghai
  const beforeReset = new Date("2026-11-18T10:00:00+08:00")
  assert.equal(
    daysUntilTrafficReset(
      {
        resetDay: 18,
        resetTime: "14:30:00",
        resetTimezone: "Asia/Shanghai",
        resetAt: "2026-11-18T14:30:00+08:00",
      },
      beforeReset,
    ),
    0,
  )

  // After 14:30:00 on the 18th, backend returns next month's resetAt -> 30 days until Dec 18
  const afterReset = new Date("2026-11-18T14:30:05+08:00")
  assert.equal(
    daysUntilTrafficReset(
      {
        resetDay: 18,
        resetTime: "14:30:00",
        resetTimezone: "Asia/Shanghai",
        resetAt: "2026-12-18T14:30:00+08:00",
      },
      afterReset,
    ),
    30,
  )

  // Even if cached node payload still carries today's just-passed resetAt before getNodes refreshes,
  // it immediately rolls forward to next month instead of staying stuck on resetToday
  assert.equal(
    daysUntilTrafficReset(
      {
        resetDay: 18,
        resetTime: "14:30:00",
        resetTimezone: "Asia/Shanghai",
        resetAt: "2026-11-18T14:30:00+08:00",
      },
      afterReset,
    ),
    30,
  )
})

test("advances default 00:00:00 midnight reset to next cycle immediately on reset day", () => {
  // Default 00:00:00 reset on the 18th has already executed by 02:56:54 on the 18th
  const morningOnResetDay = new Date("2026-11-18T02:56:54+08:00")
  assert.equal(
    daysUntilTrafficReset(
      {
        resetDay: 18,
        resetTime: "00:00:00",
        resetTimezone: "Asia/Shanghai",
      },
      morningOnResetDay,
    ),
    30,
  )
  assert.equal(daysUntilTrafficReset(18, morningOnResetDay), 30)

  // Before midnight on the 17th -> 1 day left
  const dayBefore = new Date("2026-11-17T23:00:00+08:00")
  assert.equal(daysUntilTrafficReset(18, dayBefore), 1)
})

test("wires traffic_reset_at and server clock into TrafficBar", () => {
  const utils = readFileSync(new URL("../src/lib/utils.ts", import.meta.url), "utf8")
  const card = readFileSync(new URL("../src/components/ServerCard.tsx", import.meta.url), "utf8")
  const bar = readFileSync(new URL("../src/components/TrafficBar.tsx", import.meta.url), "utf8")
  assert.match(utils, /traffic_reset_at/)
  assert.match(utils, /traffic_reset_time/)
  assert.match(utils, /traffic_reset_timezone/)
  assert.match(card, /resetAt=\{info\.traffic_reset_at\}/)
  assert.match(bar, /daysUntilTrafficReset/)
})
