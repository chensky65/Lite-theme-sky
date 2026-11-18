export type TrafficSample = {
  t: number
  up: number
  down: number
}

const MAX_SAMPLES = 48
const MAX_SERVER_BUCKETS = 256
const MIN_SAMPLE_GAP_MS = 1000
const homeSamples: TrafficSample[] = []
const serverSamples = new Map<string, TrafficSample[]>()

function appendTrafficSample(bucket: TrafficSample[], upSpeed: number, downSpeed: number, now: number): TrafficSample[] {
  const last = bucket.at(-1)
  if (!last) {
    bucket.push({ t: now - MIN_SAMPLE_GAP_MS, up: upSpeed, down: downSpeed })
    bucket.push({ t: now, up: upSpeed, down: downSpeed })
    return bucket.slice()
  }
  if (now < last.t) {
    bucket.length = 0
    bucket.push({ t: now - MIN_SAMPLE_GAP_MS, up: upSpeed, down: downSpeed })
    bucket.push({ t: now, up: upSpeed, down: downSpeed })
    return bucket.slice()
  }
  if (now - last.t < MIN_SAMPLE_GAP_MS) {
    last.up = upSpeed
    last.down = downSpeed
    last.t = now
    return bucket.slice()
  }
  bucket.push({ t: now, up: upSpeed, down: downSpeed })
  if (bucket.length > MAX_SAMPLES) bucket.splice(0, bucket.length - MAX_SAMPLES)
  return bucket.slice()
}

export function resetHomeTraffic(): void {
  homeSamples.length = 0
}

export function resetServerTraffic(serverKey?: string | number): void {
  if (serverKey === undefined) {
    serverSamples.clear()
    return
  }
  serverSamples.delete(String(serverKey))
}

export function homeTrafficWindowMs(samples: TrafficSample[]): number {
  if (samples.length < 2) return 0
  return Math.max(0, samples[samples.length - 1]!.t - samples[0]!.t)
}

export function recordHomeTraffic(upSpeed: number, downSpeed: number, now = Date.now()): TrafficSample[] {
  return appendTrafficSample(homeSamples, upSpeed, downSpeed, now)
}

export function recordServerTraffic(
  serverKey: string | number,
  upSpeed: number,
  downSpeed: number,
  now = Date.now(),
): TrafficSample[] {
  const key = String(serverKey)
  let bucket = serverSamples.get(key)
  if (!bucket) {
    if (serverSamples.size >= MAX_SERVER_BUCKETS) {
      const oldestKey = serverSamples.keys().next().value
      if (oldestKey !== undefined) serverSamples.delete(oldestKey)
    }
    bucket = []
    serverSamples.set(key, bucket)
  }
  return appendTrafficSample(bucket, upSpeed, downSpeed, now)
}

// 节点离线时服务端仍会推送最后一次的速度；这里把速度归零并取消“实时”标记，避免页面显示过期数据。
export function liveTrafficView(online: boolean, upSpeed: number, downSpeed: number) {
  return online ? { live: true, up: upSpeed, down: downSpeed } : { live: false, up: 0, down: 0 }
}
