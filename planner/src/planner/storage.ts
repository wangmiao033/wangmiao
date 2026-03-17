import type { AppState } from './types'

export const STORAGE_KEY = 'wm-personal-planner:v1'

export function defaultState(): AppState {
  const now = Date.now()
  return {
    version: 1,
    tasksByDate: {},
    yearlyTemplates: [
      {
        id: crypto.randomUUID(),
        mmdd: '01-01',
        title: '年度计划回顾/设定（模板）',
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    menstrual: {
      enabled: true,
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lutealPhaseDays: 14,
      startDates: [],
    },
    uiTheme: 'sakura',
    uiDecor: { stickers: true },
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as AppState
    if (!parsed || parsed.version !== 1) return defaultState()
    const def = defaultState()
    // 基础兜底
    parsed.tasksByDate ??= {}
    parsed.yearlyTemplates ??= []
    parsed.menstrual ??= def.menstrual
    parsed.menstrual.startDates ??= []
    parsed.uiTheme ??= 'sakura'
    parsed.uiDecor = {
      stickers: parsed.uiDecor?.stickers ?? def.uiDecor!.stickers,
    }
    return parsed
  } catch {
    return defaultState()
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY)
}

