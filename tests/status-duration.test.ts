import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { formatStatusDuration } from "../src/lib/format.ts"

test("formats a status duration as days, hours and minutes", () => {
  assert.equal(formatStatusDuration(0), "0分钟")
  assert.equal(formatStatusDuration(59), "0分钟")
  assert.equal(formatStatusDuration(60), "1分钟")
  assert.equal(formatStatusDuration(90), "1分钟")
  assert.equal(formatStatusDuration(3600), "1小时0分钟")
  assert.equal(formatStatusDuration(3660), "1小时1分钟")
  assert.equal(formatStatusDuration(86400), "1天0小时0分钟")
  assert.equal(formatStatusDuration(12 * 86400 + 5 * 3600 + 30 * 60), "12天5小时30分钟")
  assert.equal(formatStatusDuration(2 * 86400 + 3 * 3600 + 45 * 60), "2天3小时45分钟")
  assert.equal(formatStatusDuration(-100), "0分钟")
})

test("duration badge is styled green online and red offline", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf-8")
  assert.match(css, /\.lite-server-card__duration \{[\s\S]*?color:\s*#22c55e/)
  assert.match(css, /\.lite-server-card__duration--offline \{[\s\S]*?color:\s*#ff5630/)
  assert.doesNotMatch(css, /\.lite-server-card__signal \{/)
})

test("server card renders the duration badge instead of signal bars", () => {
  const card = readFileSync(new URL("../src/components/ServerCard.tsx", import.meta.url), "utf-8")
  assert.match(card, /lite-server-card__duration/)
  assert.match(card, /formatStatusDuration\(info\.statusDurationSeconds\)/)
  assert.doesNotMatch(card, /lite-server-card__signal/)
})
