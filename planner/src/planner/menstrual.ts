import type { ISODate, MenstrualSettings } from './types'
import { addDays, clamp, parseISODate, toISODate } from './date'

export type MenstrualDayKind = 'period' | 'fertile' | 'ovulation'

export type MenstrualProjection = {
  periodDays: Set<ISODate>
  fertileDays: Set<ISODate>
  ovulationDays: Set<ISODate>
  nextPredictedStart: ISODate | null
  lastRecordedStart: ISODate | null
}

function lastStart(settings: MenstrualSettings): ISODate | null {
  const arr = settings.startDates ?? []
  return arr.length ? arr[arr.length - 1] : null
}

export function recordPeriodStart(settings: MenstrualSettings, iso: ISODate): MenstrualSettings {
  const dt = parseISODate(iso)
  if (!dt) return settings
  const next = [...(settings.startDates ?? []), toISODate(dt)]
  next.sort()
  // 去重
  const uniq: ISODate[] = []
  for (const d of next) {
    if (!uniq.length || uniq[uniq.length - 1] !== d) uniq.push(d)
  }
  return { ...settings, startDates: uniq }
}

export function removePeriodStart(settings: MenstrualSettings, iso: ISODate): MenstrualSettings {
  const next = (settings.startDates ?? []).filter((d) => d !== iso)
  return { ...settings, startDates: next }
}

export function projectMenstrual(settings: MenstrualSettings, rangeStart: ISODate, rangeEnd: ISODate): MenstrualProjection {
  const periodDays = new Set<ISODate>()
  const fertileDays = new Set<ISODate>()
  const ovulationDays = new Set<ISODate>()

  if (!settings.enabled) {
    return {
      periodDays,
      fertileDays,
      ovulationDays,
      nextPredictedStart: null,
      lastRecordedStart: lastStart(settings),
    }
  }

  const cycle = clamp(Math.round(settings.cycleLengthDays || 28), 15, 60)
  const periodLen = clamp(Math.round(settings.periodLengthDays || 5), 2, 12)
  const luteal = clamp(Math.round(settings.lutealPhaseDays || 14), 8, 20)

  const last = lastStart(settings)
  if (!last) {
    return {
      periodDays,
      fertileDays,
      ovulationDays,
      nextPredictedStart: null,
      lastRecordedStart: null,
    }
  }

  // 预测思路：
  // - 从最近一次真实来潮日开始，按 cycle 循环生成后续周期
  // - 每个周期：来潮期 [start, start+periodLen)
  // - 排卵日约在下次来潮前 luteal 天：ovulation = nextStart - luteal
  // - 易孕期：排卵日前 5 天到排卵日（含），共约 6 天
  let curStart: ISODate = last

  // 如果 last 在 rangeEnd 之后，也仍然给出 nextPredictedStart
  // 但为了范围内投影，我们从可能覆盖 rangeStart 的最近周期开始迭代
  // 最多回溯 24 个周期，避免异常数据死循环
  for (let i = 0; i < 24; i++) {
    const prevStart = addDays(curStart, -cycle)
    if (prevStart < rangeStart) break
    curStart = prevStart
  }

  let nextPredictedStart: ISODate | null = null
  for (let guard = 0; guard < 36; guard++) {
    const nextStart = addDays(curStart, cycle)
    if (!nextPredictedStart) nextPredictedStart = nextStart

    // period
    for (let i = 0; i < periodLen; i++) {
      const d = addDays(curStart, i)
      if (d >= rangeStart && d <= rangeEnd) periodDays.add(d)
    }

    // ovulation & fertile
    const ov = addDays(nextStart, -luteal)
    if (ov >= rangeStart && ov <= rangeEnd) ovulationDays.add(ov)
    for (let i = -5; i <= 0; i++) {
      const d = addDays(ov, i)
      if (d >= rangeStart && d <= rangeEnd) fertileDays.add(d)
    }

    if (curStart > rangeEnd) break
    curStart = nextStart
    if (curStart > rangeEnd && nextStart > rangeEnd) break
  }

  return {
    periodDays,
    fertileDays,
    ovulationDays,
    nextPredictedStart,
    lastRecordedStart: last,
  }
}

