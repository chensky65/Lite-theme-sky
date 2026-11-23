import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { confirmNewBuild, extractEntryScriptUrl, isNewerBuild } from "../src/lib/auto-update.ts"

const oldHtml = `<!doctype html><html><head></head><body><div id="root"></div>
<script type="module" crossorigin src="/assets/index.BwlaEj4A.js"></script></body></html>`
const newHtml = `<!doctype html><html><head></head><body><div id="root"></div>
<script type="module" crossorigin src="/assets/index.CzaOM_DO.js"></script></body></html>`
const newerHtml = `<!doctype html><html><head></head><body><div id="root"></div>
<script type="module" crossorigin src="/assets/index.D9xQw2kL.js"></script></body></html>`

test("extracts the built entry script url from the served homepage", () => {
  assert.equal(extractEntryScriptUrl(newHtml), "/assets/index.CzaOM_DO.js")
  assert.equal(extractEntryScriptUrl("<html></html>"), null)
})

test("detects a newer build only when the entry script hash differs", () => {
  assert.equal(isNewerBuild("/assets/index.BwlaEj4A.js", newHtml), true)
  assert.equal(isNewerBuild("/assets/index.CzaOM_DO.js", newHtml), false)
  assert.equal(isNewerBuild("https://a.chensky65.dpdns.org:9443/assets/index.BwlaEj4A.js", newHtml), true)
  assert.equal(isNewerBuild(null, newHtml), false)
  assert.equal(isNewerBuild("/assets/index.BwlaEj4A.js", "<html></html>"), false)
})

test("confirms a newer build only when the new hash is stable across two fetches", async () => {
  const calls: string[] = []
  const fetchIndex = async () => {
    calls.push("fetch")
    return calls.length === 1 ? newHtml : newHtml
  }
  assert.equal(await confirmNewBuild(fetchIndex, "/assets/index.BwlaEj4A.js", 0), true)
  assert.equal(calls.length, 2)
})

test("does not reload when the hash changes again between the two fetches", async () => {
  const fetchIndex = (() => {
    let n = 0
    return async () => {
      n += 1
      return n === 1 ? newHtml : newerHtml
    }
  })()
  assert.equal(await confirmNewBuild(fetchIndex, "/assets/index.BwlaEj4A.js", 0), false)
})

test("does not reload when the homepage cannot be fetched", async () => {
  const fetchIndex = async (): Promise<string> => {
    throw new Error("offline")
  }
  assert.equal(await confirmNewBuild(fetchIndex, "/assets/index.BwlaEj4A.js", 0), false)
})

test("starts the auto-update checker from the app entry", () => {
  const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8")
  assert.match(main, /import \{ startAutoUpdate \} from "\.\/lib\/auto-update"/)
  assert.match(main, /startAutoUpdate\(\)/)
})
