import type { ISODate } from './types'

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  return `${y}-${m}-${day}` as ISODate
}

export function parseISODate(s: string): Date | null {
  // 仅支持 YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return dt
}

export function mmddFromISO(iso: ISODate): `${string}-${string}` {
  return iso.slice(5) as `${string}-${string}`
}

export function startOfMonth(year: number, month1: number): Date {
  return new Date(year, month1 - 1, 1)
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate()
}

export function addDays(iso: ISODate, days: number): ISODate {
  const dt = parseISODate(iso)
  if (!dt) return iso
  dt.setDate(dt.getDate() + days)
  return toISODate(dt)
}

export function isSameISO(a: ISODate, b: ISODate): boolean {
  return a === b
}

export function todayISO(): ISODate {
  return toISODate(new Date())
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

