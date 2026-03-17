export type ISODate = `${number}-${string}-${string}` // YYYY-MM-DD

export type Id = string

export type DayTask = {
  id: Id
  title: string
  done: boolean
  createdAt: number
  updatedAt: number
}

// 可复用的“每年都一样”的模板任务：绑定到某个 MM-DD
export type YearlyTemplateTask = {
  id: Id
  mmdd: `${string}-${string}` // MM-DD
  title: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export type MenstrualSettings = {
  enabled: boolean
  cycleLengthDays: number // 典型 28
  periodLengthDays: number // 典型 4~7
  lutealPhaseDays: number // 默认 14，用于估算排卵日/易孕期
  // 记录“真实来潮第一天”，用于后续预测；按时间升序存
  startDates: ISODate[]
}

export type UiTheme =
  | 'sakura'
  | 'macaron'
  | 'matcha'
  | 'night'
  | 'strawberry'
  | 'peach'
  | 'cloud'
  | 'caramel'

export type AppState = {
  version: 1
  tasksByDate: Record<ISODate, DayTask[]>
  yearlyTemplates: YearlyTemplateTask[]
  menstrual: MenstrualSettings
  uiTheme?: UiTheme
  uiDecor?: {
    stickers: boolean
  }
}

