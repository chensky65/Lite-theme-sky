import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { getStatusDurationCards } from "../src/lib/format.ts"

test("splits an online duration into days only", () => {
  assert.deepEqual(getStatusDurationCards(0, true), [{ value: "0", unit: "小时" }])
  assert.deepEqual(getStatusDurationCards(1800, true), [{ value: "0", unit: "小时" }])
  assert.deepEqual(getStatusDurationCards(3600, true), [{ value: "1", unit: "小时" }])
  assert.deepEqual(getStatusDurationCards(5 * 3600 + 30 * 60, true), [{ value: "5", unit: "小时" }])
  assert.deepEqual(getStatusDurationCards(86400, true), [{ value: "1", unit: "天" }])
  assert.deepEqual(getStatusDurationCards(12 * 86400 + 5 * 3600 + 30 * 60, true), [{ value: "12", unit: "天" }])
  assert.deepEqual(getStatusDurationCards(2 * 86400 + 0 * 3600 + 15 * 60, true), [{ value: "2", unit: "天" }])
  assert.deepEqual(getStatusDurationCards(-100, true), [{ value: "0", unit: "小时" }])
})

test("splits an offline duration into hours, minutes and seconds", () => {
  assert.deepEqual(getStatusDurationCards(0, false), [{ value: "00", unit: "小时" }, { value: "00", unit: "分" }, { value: "00", unit: "秒" }])
  assert.deepEqual(getStatusDurationCards(59, false), [{ value: "00", unit: "小时" }, { value: "00", unit: "分" }, { value: "59", unit: "秒" }])
  assert.deepEqual(getStatusDurationCards(60, false), [{ value: "00", unit: "小时" }, { value: "01", unit: "分" }, { value: "00", unit: "秒" }])
  assert.deepEqual(getStatusDurationCards(2 * 3600 + 30 * 60, false), [{ value: "02", unit: "小时" }, { value: "30", unit: "分" }, { value: "00", unit: "秒" }])
  assert.deepEqual(getStatusDurationCards(2 * 3600 + 30 * 60 + 45, false), [{ value: "02", unit: "小时" }, { value: "30", unit: "分" }, { value: "45", unit: "秒" }])
  assert.deepEqual(getStatusDurationCards(25 * 3600 + 15 * 60, false), [{ value: "25", unit: "小时" }, { value: "15", unit: "分" }, { value: "00", unit: "秒" }])
  assert.deepEqual(getStatusDurationCards(-100, false), [{ value: "00", unit: "小时" }, { value: "00", unit: "分" }, { value: "00", unit: "秒" }])
})

test("duration badge is one capsule, green text on translucent green online and red offline, number and unit one size", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf-8")
  assert.match(css, /\.lite-duration-pill \{[\s\S]*?border-radius:\s*999px/)
  assert.match(css, /\.lite-duration-pill \{[\s\S]*?background:\s*rgba\(34,\s*197,\s*94,\s*0\.14\)/)
  assert.match(css, /\.lite-duration-pill__num \{[\s\S]*?font-size:\s*11px/)
  assert.match(css, /\.lite-duration-pill__unit \{[\s\S]*?font-size:\s*11px/)
  assert.match(css, /\.lite-duration-pill__num \{[\s\S]*?color:\s*#22c55e/)
  assert.match(css, /\.lite-server-card__duration--offline \.lite-duration-pill \{[\s\S]*?background:\s*rgba\(255,\s*86,\s*48,\s*0\.14\)/)
  assert.doesNotMatch(css, /\.lite-server-card__signal \{/)
  assert.doesNotMatch(css, /\.lite-duration-card \{/)
  assert.doesNotMatch(css, /\.lite-duration-block \{/)
})

test("server card renders the duration as one capsule instead of signal bars", () => {
  const card = readFileSync(new URL("../src/components/ServerCard.tsx", import.meta.url), "utf-8")
  assert.match(card, /lite-server-card__duration/)
  assert.match(card, /lite-duration-pill/)
  assert.match(card, /getStatusDurationCards\(displayDurationSeconds, info\.online\)/)
  assert.doesNotMatch(card, /lite-server-card__signal/)
  assert.doesNotMatch(card, /lite-duration-block"/)
})

test("duration badge ticks live every second like a clock", () => {
  const card = readFileSync(new URL("../src/components/ServerCard.tsx", import.meta.url), "utf-8")
  // A 1s interval re-renders the card; the displayed value is the anchored
  // server duration plus wall-clock seconds since the anchor, re-anchored
  // whenever new data arrives.
  assert.match(card, /setInterval\(\(\) => setNowMs\(Date\.now\(\)\), 1000\)/)
  assert.match(card, /durationAnchor\.current = \{ seconds: info\.statusDurationSeconds, at: Date\.now\(\) \}/)
  assert.match(card, /displayDurationSeconds/)
})
