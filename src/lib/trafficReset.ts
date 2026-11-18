const DAY_MS = 24 * 60 * 60 * 1000

export interface TrafficResetScheduleInput {
  resetDay?: number
  resetTime?: string
  resetTimezone?: string
  resetAt?: string
}

interface CalendarClock {
  year: number
  month: number // 1..12
  day: number // 1..31
  hour: number
  minute: number
  second: number
}

function daysInCalendarMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function nextYearMonth(year: number, month: number): { year: number; month: number } {
  if (month >= 12) return { year: year + 1, month: 1 }
  return { year, month: month + 1 }
}

function parseResetClock(value?: string): { hour: number; minute: number; second: number } {
  const trimmed = String(value || "").trim()
  if (!trimmed) return { hour: 0, minute: 0, second: 0 }
  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/)
  if (!match) return { hour: 0, minute: 0, second: 0 }
  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = match[3] !== undefined ? Number(match[3]) : 0
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return { hour: 0, minute: 0, second: 0 }
  }
  return { hour, minute, second }
}

function localCalendarClock(date: Date): CalendarClock {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  }
}

function calendarClockInZone(date: Date, timeZone?: string): CalendarClock {
  const tz = String(timeZone || "").trim()
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(date)
      const get = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? NaN)
      const year = get("year")
      const month = get("month")
      const day = get("day")
      const hour = get("hour")
      const minute = get("minute")
      const second = get("second")
      if ([year, month, day, hour, minute, second].every(Number.isFinite)) {
        return { year, month, day, hour: hour === 24 ? 0 : hour, minute, second }
      }
    } catch {
      // Fall back to local calendar parts when timezone is unrecognized.
    }
  }
  return localCalendarClock(date)
}

function calendarDayDiff(
  from: Pick<CalendarClock, "year" | "month" | "day">,
  to: Pick<CalendarClock, "year" | "month" | "day">,
): number {
  const fromUTC = Date.UTC(from.year, from.month - 1, from.day)
  const toUTC = Date.UTC(to.year, to.month - 1, to.day)
  return Math.max(0, Math.round((toUTC - fromUTC) / DAY_MS))
}

function isBeforeBoundary(
  current: CalendarClock,
  targetDay: number,
  clock: { hour: number; minute: number; second: number },
): boolean {
  if (current.day !== targetDay) return current.day < targetDay
  if (current.hour !== clock.hour) return current.hour < clock.hour
  if (current.minute !== clock.minute) return current.minute < clock.minute
  return current.second < clock.second
}

function advanceLocalInstantByMonths(resetMs: number, nowMs: number): Date {
  const origin = new Date(resetMs)
  const targetDay = origin.getDate()
  let year = origin.getFullYear()
  let month = origin.getMonth() + 1
  let candidate = origin

  for (let guard = 0; guard < 24 && candidate.getTime() <= nowMs; guard++) {
    const next = nextYearMonth(year, month)
    year = next.year
    month = next.month
    const clampedDay = Math.min(targetDay, daysInCalendarMonth(year, month))
    candidate = new Date(
      year,
      month - 1,
      clampedDay,
      origin.getHours(),
      origin.getMinutes(),
      origin.getSeconds(),
      origin.getMilliseconds(),
    )
  }
  return candidate
}

export function daysUntilTrafficReset(
  input?: number | TrafficResetScheduleInput,
  now: Date | number = new Date(),
): number | undefined {
  const schedule: TrafficResetScheduleInput = typeof input === "number" ? { resetDay: input } : input || {}
  const nowMs = typeof now === "number" ? now : now.getTime()
  if (!Number.isFinite(nowMs)) return undefined
  const nowDate = new Date(nowMs)

  const resetAtRaw = String(schedule.resetAt || "").trim()
  const parsedResetAt = resetAtRaw ? Date.parse(resetAtRaw) : NaN
  if (Number.isFinite(parsedResetAt)) {
    const nextResetDate =
      parsedResetAt > nowMs ? new Date(parsedResetAt) : advanceLocalInstantByMonths(parsedResetAt, nowMs)
    return calendarDayDiff(localCalendarClock(nowDate), localCalendarClock(nextResetDate))
  }

  const resetDay = schedule.resetDay
  if (!Number.isInteger(resetDay) || !resetDay || resetDay < 1 || resetDay > 31) return undefined

  const clock = parseResetClock(schedule.resetTime)
  const current = calendarClockInZone(nowDate, schedule.resetTimezone)
  const thisMonthDay = Math.min(resetDay, daysInCalendarMonth(current.year, current.month))

  if (isBeforeBoundary(current, thisMonthDay, clock)) {
    return calendarDayDiff(current, { year: current.year, month: current.month, day: thisMonthDay })
  }

  const next = nextYearMonth(current.year, current.month)
  const nextMonthDay = Math.min(resetDay, daysInCalendarMonth(next.year, next.month))
  return calendarDayDiff(current, { year: next.year, month: next.month, day: nextMonthDay })
}
