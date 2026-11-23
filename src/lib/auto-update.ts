// 强制刷新:面板部署新版后,已打开的旧页面自动重新加载,不再停留在旧版。
// 原理:首页 index.html 每次构建引用的入口 JS 文件名都带新哈希,定时拉一份
// 新鲜的首页比对哈希,变了就说明服务器已部署新版。两次拉取哈希一致才刷新,
// 避免部署中的半成品触发刷新;新版 JS 只用 GET 校验(面板静态服务不支持 HEAD)。

const ENTRY_SCRIPT_PATTERN = /src=["']([^"']*\/assets\/index\.[^"']+\.js)["']/

export function extractEntryScriptUrl(html: string): string | null {
  const match = ENTRY_SCRIPT_PATTERN.exec(html)
  return match ? match[1] : null
}

function entryScriptKey(url: string): string {
  const match = /\/assets\/index\.[^"'\s]+\.js/.exec(url)
  return match ? match[0] : url
}

export function isNewerBuild(currentScriptUrl: string | null, html: string): boolean {
  if (!currentScriptUrl) return false
  const next = extractEntryScriptUrl(html)
  if (!next) return false
  return entryScriptKey(next) !== entryScriptKey(currentScriptUrl)
}

export async function confirmNewBuild(
  fetchIndex: () => Promise<string>,
  currentScriptUrl: string | null,
  waitMs = 2000,
): Promise<boolean> {
  const first = await fetchIndex().catch(() => null)
  if (first === null || !isNewerBuild(currentScriptUrl, first)) return false
  const next = extractEntryScriptUrl(first)
  await new Promise((resolve) => setTimeout(resolve, waitMs))
  const second = await fetchIndex().catch(() => null)
  if (second === null) return false
  return extractEntryScriptUrl(second) === next
}

let started = false

export function startAutoUpdate(intervalMs = 60000): void {
  if (typeof window === "undefined" || typeof document === "undefined") return
  if (import.meta.env.DEV) return
  if (started) return
  started = true

  let checking = false

  const currentScriptUrl = (): string => {
    const tag = document.querySelector('script[type="module"][src*="/assets/index."]')
    const src = tag?.getAttribute("src")
    if (src) return src
    return import.meta.url
  }

  const fetchIndex = async (): Promise<string> => {
    const res = await fetch("/", { cache: "no-store" })
    if (!res.ok) throw new Error(`index fetch failed: ${res.status}`)
    return res.text()
  }

  const check = async (): Promise<void> => {
    if (checking) return
    checking = true
    try {
      const shouldReload = await confirmNewBuild(fetchIndex, currentScriptUrl())
      if (shouldReload) window.location.reload()
    } catch {
      // 离线或请求失败:什么都不做,下次再查
    } finally {
      checking = false
    }
  }

  window.setTimeout(check, 5000)
  window.setInterval(check, intervalMs)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void check()
  })
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void check()
  })
  window.addEventListener("focus", () => void check())
}
