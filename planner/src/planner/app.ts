import type { AppState, DayTask, ISODate, UiTheme, YearlyTemplateTask } from './types'
import { clamp, daysInMonth, mmddFromISO, pad2, startOfMonth, todayISO } from './date'
import { projectMenstrual, recordPeriodStart, removePeriodStart } from './menstrual'
import { clearState, loadState, saveState } from './storage'

type ViewMonth = { year: number; month1: number } // month1: 1-12

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  for (const c of children) node.append(c)
  return node
}

function fmtMonthLabel(v: ViewMonth): string {
  return `${v.year}年${v.month1}月`
}

function monthKey(v: ViewMonth): string {
  return `${v.year}-${pad2(v.month1)}`
}

function firstDayOffset(v: ViewMonth): number {
  // 周一为第一列（0=周一 ... 6=周日）
  const d = startOfMonth(v.year, v.month1)
  const js = d.getDay() // 0=Sun
  return (js + 6) % 7
}

function isoForDay(v: ViewMonth, day: number): ISODate {
  return `${v.year}-${pad2(v.month1)}-${pad2(day)}` as ISODate
}

function getDayTasks(state: AppState, iso: ISODate): DayTask[] {
  return state.tasksByDate[iso] ?? []
}

function setDayTasks(state: AppState, iso: ISODate, tasks: DayTask[]): void {
  state.tasksByDate[iso] = tasks
}

function getTemplateTasksFor(state: AppState, iso: ISODate): YearlyTemplateTask[] {
  const mmdd = mmddFromISO(iso)
  return state.yearlyTemplates.filter((t) => t.enabled && t.mmdd === mmdd)
}

function uid(): string {
  return crypto.randomUUID()
}

function normalizeTitle(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

function isISODate(s: string): s is ISODate {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

const THEMES: Array<{ id: UiTheme; name: string; emoji: string; desc: string; themeColor: string }> = [
  { id: 'sakura', name: '樱花少女', emoji: '🌸', desc: '更粉更甜、奶油感', themeColor: '#fff7fb' },
  { id: 'strawberry', name: '草莓奶昔', emoji: '🍓', desc: '高甜粉红、元气', themeColor: '#fff1f6' },
  { id: 'peach', name: '蜜桃汽水', emoji: '🍑', desc: '蜜桃橙粉、清爽', themeColor: '#fff4ee' },
  { id: 'cloud', name: '云朵蓝莓', emoji: '☁️', desc: '云朵蓝紫、梦幻', themeColor: '#f4f7ff' },
  { id: 'macaron', name: '马卡龙紫', emoji: '🫧', desc: '梦幻柔紫、清透', themeColor: '#fff8ff' },
  { id: 'matcha', name: '奶油抹茶', emoji: '🍵', desc: '温柔奶绿、护眼', themeColor: '#fbfff8' },
  { id: 'caramel', name: '焦糖奶油', emoji: '🍮', desc: '奶茶焦糖、温暖', themeColor: '#fff8ef' },
  { id: 'night', name: '夜间梦幻', emoji: '🌙', desc: '深色模式、低刺激', themeColor: '#0b0c10' },
]

export function mountApp(root: HTMLDivElement): void {
  let state = loadState()
  let selected: ISODate = todayISO()

  const now = new Date()
  let view: ViewMonth = { year: now.getFullYear(), month1: now.getMonth() + 1 }

  // 若 selected 不在当前 view 月，切过去
  const selY = Number(selected.slice(0, 4))
  const selM = Number(selected.slice(5, 7))
  if (!Number.isNaN(selY) && !Number.isNaN(selM)) view = { year: selY, month1: selM }

  root.innerHTML = ''
  root.classList.add('wm-root')
  root.dataset.theme = state.uiTheme ?? 'sakura'
  root.dataset.stickers = state.uiDecor?.stickers ? 'on' : 'off'

  const header = el('header', { class: 'wm-header' })
  const title = el('div', { class: 'wm-title' }, [
    el('div', { class: 'wm-title-main' }, ['个人日程']),
    el('div', { class: 'wm-title-sub' }, ['日历 / 待办 / 年度模板 / 经期预测（本地离线）']),
  ])
  const nav = el('div', { class: 'wm-nav' })
  const btnPrev = el('button', { class: 'wm-btn', type: 'button' }, ['‹ 上月'])
  const btnToday = el('button', { class: 'wm-btn', type: 'button' }, ['今天'])
  const btnNext = el('button', { class: 'wm-btn', type: 'button' }, ['下月 ›'])
  const monthLabel = el('div', { class: 'wm-month' }, [fmtMonthLabel(view)])

  const btnSettings = el('button', { class: 'wm-btn wm-btn-primary', type: 'button' }, ['设置'])
  nav.append(btnPrev, btnToday, btnNext, monthLabel, btnSettings)
  header.append(title, nav)

  const main = el('main', { class: 'wm-main' })
  const calPanel = el('section', { class: 'wm-panel' })
  const detailPanel = el('section', { class: 'wm-panel wm-panel-detail' })

  const calHeader = el('div', { class: 'wm-panel-header' }, [
    el('div', { class: 'wm-panel-title' }, ['日历']),
    el('div', { class: 'wm-panel-meta', 'data-monthkey': monthKey(view) }, ['']),
  ])

  const weekRow = el('div', { class: 'wm-week' }, ['一', '二', '三', '四', '五', '六', '日'].map((w) => el('div', { class: 'wm-weekday' }, [w])))
  const grid = el('div', { class: 'wm-grid' })
  calPanel.append(calHeader, weekRow, grid)

  const detailHeader = el('div', { class: 'wm-panel-header wm-detail-header' })
  const detailTitle = el('div', { class: 'wm-panel-title' }, [''])
  const detailBadges = el('div', { class: 'wm-badges' })
  detailHeader.append(detailTitle, detailBadges)

  const templateBox = el('div', { class: 'wm-template-box' })
  const templateTitle = el('div', { class: 'wm-subtitle' }, ['年度模板（每年这一天自动出现）'])
  const templateList = el('div', { class: 'wm-template-list' })
  templateBox.append(templateTitle, templateList)

  const tasksBox = el('div', { class: 'wm-tasks-box' })
  const tasksTitle = el('div', { class: 'wm-subtitle' }, ['当日待办'])
  const tasksList = el('div', { class: 'wm-tasks' })
  const taskInputRow = el('div', { class: 'wm-row' })
  const taskInput = el('input', { class: 'wm-input', placeholder: '添加一条待办（回车保存）' })
  const btnAddTask = el('button', { class: 'wm-btn', type: 'button' }, ['添加'])
  taskInputRow.append(taskInput, btnAddTask)
  tasksBox.append(tasksTitle, tasksList, taskInputRow)

  const menstrualBox = el('div', { class: 'wm-menstrual-box' })
  const menstrualTitle = el('div', { class: 'wm-subtitle' }, ['经期'])
  const menstrualRow = el('div', { class: 'wm-row wm-row-wrap' })
  const btnMarkStart = el('button', { class: 'wm-btn', type: 'button' }, ['标记：今天是来潮第一天'])
  const btnUnmarkStart = el('button', { class: 'wm-btn', type: 'button' }, ['撤销：移除这天的来潮记录'])
  const menstrualHint = el('div', { class: 'wm-hint' }, ['（仅做预测与提醒用途；数据只保存在本机浏览器）'])
  menstrualRow.append(btnMarkStart, btnUnmarkStart)
  menstrualBox.append(menstrualTitle, menstrualRow, menstrualHint)

  detailPanel.append(detailHeader, templateBox, tasksBox, menstrualBox)
  main.append(calPanel, detailPanel)

  const settings = el('dialog', { class: 'wm-dialog' })
  settings.append(
    el('div', { class: 'wm-dialog-head' }, [
      el('div', { class: 'wm-dialog-title' }, ['设置']),
      el('button', { class: 'wm-btn', type: 'button', 'data-close': '1' }, ['关闭']),
    ]),
  )

  const settingBody = el('div', { class: 'wm-dialog-body' })
  const secTemplates = el('section', { class: 'wm-setting-sec' })
  secTemplates.append(el('h3', { class: 'wm-h3' }, ['年度模板任务']))
  const tplForm = el('div', { class: 'wm-row wm-row-wrap' })
  const mmInput = el('input', { class: 'wm-input wm-input-small', placeholder: 'MM-DD，例如 03-08' })
  const tplTitleInput = el('input', { class: 'wm-input', placeholder: '模板任务内容，例如：体检/纪念日/年度复盘' })
  const btnAddTpl = el('button', { class: 'wm-btn wm-btn-primary', type: 'button' }, ['新增模板'])
  tplForm.append(mmInput, tplTitleInput, btnAddTpl)
  const tplList = el('div', { class: 'wm-setting-list' })
  secTemplates.append(tplForm, tplList)

  const secMenstrual = el('section', { class: 'wm-setting-sec' })
  secMenstrual.append(el('h3', { class: 'wm-h3' }, ['经期预测参数']))
  const msRow = el('div', { class: 'wm-row wm-row-wrap' })
  const msEnabled = el('input', { type: 'checkbox', class: 'wm-checkbox' })
  const msEnabledLabel = el('label', { class: 'wm-checklabel' }, [msEnabled, '启用经期预测'])
  const cycleInput = el('input', { class: 'wm-input wm-input-small', inputmode: 'numeric', placeholder: '周期(天)' })
  const periodInput = el('input', { class: 'wm-input wm-input-small', inputmode: 'numeric', placeholder: '经期(天)' })
  const lutealInput = el('input', { class: 'wm-input wm-input-small', inputmode: 'numeric', placeholder: '黄体期(天)' })
  const btnSaveMs = el('button', { class: 'wm-btn wm-btn-primary', type: 'button' }, ['保存'])
  msRow.append(msEnabledLabel, cycleInput, periodInput, lutealInput, btnSaveMs)
  secMenstrual.append(msRow, el('div', { class: 'wm-hint' }, ['提示：黄体期一般取 14 天；这里只用于估算排卵/易孕期。']))

  const msHistoryTitle = el('h3', { class: 'wm-h3' }, ['来潮记录（第一天）'])
  const msHistoryForm = el('div', { class: 'wm-row wm-row-wrap' })
  const msDateInput = el('input', { class: 'wm-input wm-input-small', placeholder: 'YYYY-MM-DD，例如 2026-03-17' })
  const btnAddMsDate = el('button', { class: 'wm-btn', type: 'button' }, ['新增记录'])
  msHistoryForm.append(msDateInput, btnAddMsDate)
  const msHistoryList = el('div', { class: 'wm-setting-list' })
  secMenstrual.append(msHistoryTitle, msHistoryForm, msHistoryList)

  const secData = el('section', { class: 'wm-setting-sec' })
  secData.append(el('h3', { class: 'wm-h3' }, ['数据导入/导出（可跨设备备份）']))
  const dataRow = el('div', { class: 'wm-row wm-row-wrap' })
  const btnExport = el('button', { class: 'wm-btn', type: 'button' }, ['导出 JSON'])
  const importInput = el('input', { type: 'file', class: 'wm-input', accept: 'application/json' })
  const btnImport = el('button', { class: 'wm-btn', type: 'button' }, ['导入（会覆盖本地数据）'])
  const btnReset = el('button', { class: 'wm-btn wm-btn-danger', type: 'button' }, ['清空本地数据'])
  dataRow.append(btnExport, importInput, btnImport, btnReset)
  secData.append(dataRow, el('div', { class: 'wm-hint' }, ['建议：先导出备份，再进行导入/清空。']))

  const secTheme = el('section', { class: 'wm-setting-sec' })
  secTheme.append(el('h3', { class: 'wm-h3' }, ['皮肤 / 主题']))
  const themeGrid = el('div', { class: 'wm-theme-grid' })
  const decorRow = el('div', { class: 'wm-row wm-row-wrap' })
  const stickersToggle = el('input', { type: 'checkbox', class: 'wm-checkbox' }) as HTMLInputElement
  const stickersLabel = el('label', { class: 'wm-checklabel' }, [stickersToggle, '贴纸装饰（更可爱）'])
  decorRow.append(stickersLabel)
  secTheme.append(themeGrid, decorRow, el('div', { class: 'wm-hint' }, ['提示：皮肤/贴纸只影响外观，不影响你的日程数据。']))

  settingBody.append(secTheme, secTemplates, secMenstrual, secData)
  settings.append(settingBody)

  root.append(header, main, settings)

  function persist(): void {
    saveState(state)
  }

  function applyTheme(theme: UiTheme): void {
    state.uiTheme = theme
    root.dataset.theme = theme
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const def = THEMES.find((x) => x.id === theme)?.themeColor
    if (meta && def) meta.content = def
  }

  function applyDecor(): void {
    root.dataset.stickers = state.uiDecor?.stickers ? 'on' : 'off'
  }

  function renderSettings(): void {
    themeGrid.innerHTML = ''
    const active = (state.uiTheme ?? 'sakura') as UiTheme
    for (const t of THEMES) {
      const btn = el('button', { class: 'wm-theme-card', type: 'button', 'data-theme': t.id })
      if (t.id === active) btn.classList.add('wm-theme-card-active')
      btn.append(
        el('div', { class: 'wm-theme-top' }, [
          el('div', { class: 'wm-theme-emoji' }, [t.emoji]),
          el('div', { class: 'wm-theme-swatch', 'data-theme-swatch': t.id }, ['']),
        ]),
        el('div', { class: 'wm-theme-name' }, [t.name]),
        el('div', { class: 'wm-theme-desc' }, [t.desc]),
      )
      btn.addEventListener('click', () => {
        applyTheme(t.id)
        persist()
        renderSettings()
      })
      themeGrid.append(btn)
    }
    stickersToggle.checked = !!state.uiDecor?.stickers

    tplList.innerHTML = ''
    for (const t of state.yearlyTemplates) {
      const row = el('div', { class: 'wm-setting-item' })
      const left = el('div', { class: 'wm-setting-item-main' }, [
        el('div', { class: 'wm-setting-item-title' }, [`${t.mmdd}  ${t.title}`]),
        el('div', { class: 'wm-setting-item-sub' }, [t.enabled ? '启用' : '停用']),
      ])
      const right = el('div', { class: 'wm-setting-item-actions' })
      const toggle = el('button', { class: 'wm-btn', type: 'button' }, [t.enabled ? '停用' : '启用'])
      const del = el('button', { class: 'wm-btn wm-btn-danger', type: 'button' }, ['删除'])
      toggle.addEventListener('click', () => {
        t.enabled = !t.enabled
        t.updatedAt = Date.now()
        persist()
        renderAll()
      })
      del.addEventListener('click', () => {
        state.yearlyTemplates = state.yearlyTemplates.filter((x) => x.id !== t.id)
        persist()
        renderAll()
      })
      right.append(toggle, del)
      row.append(left, right)
      tplList.append(row)
    }

    msEnabled.checked = !!state.menstrual.enabled
    cycleInput.value = String(state.menstrual.cycleLengthDays ?? 28)
    periodInput.value = String(state.menstrual.periodLengthDays ?? 5)
    lutealInput.value = String(state.menstrual.lutealPhaseDays ?? 14)

    msHistoryList.innerHTML = ''
    const dates = [...(state.menstrual.startDates ?? [])].slice().sort()
    if (!dates.length) {
      msHistoryList.append(el('div', { class: 'wm-empty' }, ['还没有记录。你可以在日历里标记，或在这里手动新增。']))
    } else {
      for (const d of dates) {
        const row = el('div', { class: 'wm-setting-item' })
        const left = el('div', { class: 'wm-setting-item-main' }, [
          el('div', { class: 'wm-setting-item-title' }, [d]),
          el('div', { class: 'wm-setting-item-sub' }, ['来潮第一天']),
        ])
        const right = el('div', { class: 'wm-setting-item-actions' })
        const jump = el('button', { class: 'wm-btn', type: 'button' }, ['跳转'])
        const del = el('button', { class: 'wm-btn wm-btn-danger', type: 'button' }, ['删除'])
        jump.addEventListener('click', () => {
          selected = d
          const y = Number(d.slice(0, 4))
          const m = Number(d.slice(5, 7))
          if (!Number.isNaN(y) && !Number.isNaN(m)) view = { year: y, month1: m }
          renderAll()
          settings.close()
        })
        del.addEventListener('click', () => {
          state.menstrual = removePeriodStart(state.menstrual, d)
          persist()
          renderAll()
        })
        right.append(jump, del)
        row.append(left, right)
        msHistoryList.append(row)
      }
    }
  }

  function renderCalendar(): void {
    monthLabel.textContent = fmtMonthLabel(view)
    grid.innerHTML = ''

    const monthDays = daysInMonth(view.year, view.month1)
    const offset = firstDayOffset(view)

    const rangeStart = isoForDay(view, 1)
    const rangeEnd = isoForDay(view, monthDays)
    const proj = projectMenstrual(state.menstrual, rangeStart, rangeEnd)

    // 6 行 * 7 列
    const cells = 42
    const today = todayISO()
    for (let i = 0; i < cells; i++) {
      const dayNum = i - offset + 1
      const inMonth = dayNum >= 1 && dayNum <= monthDays
      const cell = el('button', { class: 'wm-day', type: 'button' })

      if (!inMonth) {
        cell.classList.add('wm-day-out')
        cell.disabled = true
        cell.textContent = ''
        grid.append(cell)
        continue
      }

      const iso = isoForDay(view, dayNum)
      cell.dataset.iso = iso
      cell.append(el('div', { class: 'wm-day-num' }, [String(dayNum)]))

      const tasks = getDayTasks(state, iso)
      const tpl = getTemplateTasksFor(state, iso)
      const todoCount = tasks.filter((t) => !t.done).length + tpl.length
      if (todoCount > 0) cell.append(el('div', { class: 'wm-day-dot' }, [String(todoCount)]))

      if (iso === today) cell.classList.add('wm-day-today')
      if (iso === selected) cell.classList.add('wm-day-selected')

      if (proj.periodDays.has(iso)) cell.classList.add('wm-day-period')
      if (proj.fertileDays.has(iso)) cell.classList.add('wm-day-fertile')
      if (proj.ovulationDays.has(iso)) cell.classList.add('wm-day-ovulation')

      cell.addEventListener('click', () => {
        selected = iso
        // 切换 view 以保证同月（一般不会变）
        renderAll()
      })
      grid.append(cell)
    }
  }

  function renderDetail(): void {
    detailTitle.textContent = selected
    detailBadges.innerHTML = ''

    const mmdd = mmddFromISO(selected)
    const proj = projectMenstrual(state.menstrual, selected, selected)
    const badges: Array<{ text: string; cls: string }> = []
    if (proj.periodDays.has(selected)) badges.push({ text: '经期', cls: 'wm-badge wm-badge-period' })
    if (proj.ovulationDays.has(selected)) badges.push({ text: '排卵日(估)', cls: 'wm-badge wm-badge-ovulation' })
    if (proj.fertileDays.has(selected)) badges.push({ text: '易孕期(估)', cls: 'wm-badge wm-badge-fertile' })

    // 今日/选中日期是否被记录为“真实来潮第一天”
    const recorded = (state.menstrual.startDates ?? []).includes(selected)
    if (recorded) badges.push({ text: '已记录：来潮第一天', cls: 'wm-badge wm-badge-record' })

    for (const b of badges) detailBadges.append(el('span', { class: b.cls }, [b.text]))

    // templates
    templateList.innerHTML = ''
    const tpls = getTemplateTasksFor(state, selected)
    if (!tpls.length) {
      templateList.append(el('div', { class: 'wm-empty' }, [`${mmdd} 没有模板任务。`]))
    } else {
      for (const t of tpls) {
        const item = el('div', { class: 'wm-task wm-task-template' })
        const left = el('div', { class: 'wm-setting-item-main' })
        left.append(el('div', { class: 'wm-task-title' }, [t.title]), el('div', { class: 'wm-task-meta' }, ['年度模板']))
        const actions = el('div', { class: 'wm-task-actions' })
        const add = el('button', { class: 'wm-btn wm-btn-small', type: 'button' }, ['加入待办'])
        add.addEventListener('click', () => {
          const now = Date.now()
          const next: DayTask[] = [
            ...getDayTasks(state, selected),
            { id: uid(), title: t.title, done: false, createdAt: now, updatedAt: now },
          ]
          setDayTasks(state, selected, next)
          persist()
          renderAll()
        })
        actions.append(add)
        item.append(left, actions)
        templateList.append(item)
      }
    }

    // day tasks
    tasksList.innerHTML = ''
    const tasks = getDayTasks(state, selected)
    if (!tasks.length) {
      tasksList.append(el('div', { class: 'wm-empty' }, ['今天还没有待办。']))
    } else {
      for (const t of tasks) {
        const row = el('div', { class: 'wm-task' })
        const left = el('label', { class: 'wm-task-left' })
        const cb = el('input', { type: 'checkbox', class: 'wm-checkbox' }) as HTMLInputElement
        cb.checked = t.done
        const text = el('span', { class: 'wm-task-title' }, [t.title])
        left.append(cb, text)

        const right = el('div', { class: 'wm-task-actions' })
        const edit = el('button', { class: 'wm-btn wm-btn-small', type: 'button' }, ['编辑'])
        const del = el('button', { class: 'wm-btn wm-btn-danger wm-btn-small', type: 'button' }, ['删除'])
        right.append(edit, del)
        row.append(left, right)
        if (t.done) row.classList.add('wm-task-done')

        cb.addEventListener('change', () => {
          t.done = cb.checked
          t.updatedAt = Date.now()
          persist()
          renderAll()
        })
        edit.addEventListener('click', () => {
          const nextTitle = normalizeTitle(window.prompt('修改待办内容：', t.title) ?? '')
          if (!nextTitle) return
          t.title = nextTitle
          t.updatedAt = Date.now()
          persist()
          renderAll()
        })
        del.addEventListener('click', () => {
          const next = tasks.filter((x) => x.id !== t.id)
          setDayTasks(state, selected, next)
          persist()
          renderAll()
        })
        tasksList.append(row)
      }
    }

    btnUnmarkStart.disabled = !(state.menstrual.startDates ?? []).includes(selected)
  }

  function renderAll(): void {
    renderCalendar()
    renderDetail()
    renderSettings()
  }

  function shiftMonth(delta: number): void {
    const d = new Date(view.year, view.month1 - 1 + delta, 1)
    view = { year: d.getFullYear(), month1: d.getMonth() + 1 }
    // 若 selected 不在这个月，就选 1 号
    const y = Number(selected.slice(0, 4))
    const m = Number(selected.slice(5, 7))
    if (y !== view.year || m !== view.month1) selected = isoForDay(view, 1)
  }

  function addTaskFromInput(): void {
    const title = normalizeTitle((taskInput as HTMLInputElement).value)
    if (!title) return
    const now = Date.now()
    const next: DayTask[] = [
      ...getDayTasks(state, selected),
      { id: uid(), title, done: false, createdAt: now, updatedAt: now },
    ]
    setDayTasks(state, selected, next)
    ;(taskInput as HTMLInputElement).value = ''
    persist()
    renderAll()
  }

  btnPrev.addEventListener('click', () => {
    shiftMonth(-1)
    renderAll()
  })
  btnNext.addEventListener('click', () => {
    shiftMonth(1)
    renderAll()
  })
  btnToday.addEventListener('click', () => {
    selected = todayISO()
    const y = Number(selected.slice(0, 4))
    const m = Number(selected.slice(5, 7))
    if (!Number.isNaN(y) && !Number.isNaN(m)) view = { year: y, month1: m }
    renderAll()
  })

  btnSettings.addEventListener('click', () => {
    if (!settings.open) settings.showModal()
  })

  stickersToggle.addEventListener('change', () => {
    state.uiDecor ??= { stickers: true }
    state.uiDecor.stickers = stickersToggle.checked
    applyDecor()
    persist()
  })

  settings.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
    if (t instanceof HTMLButtonElement && t.dataset.close) settings.close()
  })

  btnAddTask.addEventListener('click', addTaskFromInput)
  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTaskFromInput()
  })

  btnAddTpl.addEventListener('click', () => {
    const mmdd = normalizeTitle((mmInput as HTMLInputElement).value)
    const title = normalizeTitle((tplTitleInput as HTMLInputElement).value)
    if (!/^\d{2}-\d{2}$/.test(mmdd)) return
    if (!title) return
    const now = Date.now()
    state.yearlyTemplates.unshift({
      id: uid(),
      mmdd: mmdd as `${string}-${string}`,
      title,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })
    ;(mmInput as HTMLInputElement).value = ''
    ;(tplTitleInput as HTMLInputElement).value = ''
    persist()
    renderAll()
  })

  btnSaveMs.addEventListener('click', () => {
    state.menstrual.enabled = (msEnabled as HTMLInputElement).checked
    state.menstrual.cycleLengthDays = clamp(Number((cycleInput as HTMLInputElement).value || 28), 15, 60)
    state.menstrual.periodLengthDays = clamp(Number((periodInput as HTMLInputElement).value || 5), 2, 12)
    state.menstrual.lutealPhaseDays = clamp(Number((lutealInput as HTMLInputElement).value || 14), 8, 20)
    persist()
    renderAll()
  })

  btnAddMsDate.addEventListener('click', () => {
    const raw = normalizeTitle((msDateInput as HTMLInputElement).value)
    if (!isISODate(raw)) return
    state.menstrual = recordPeriodStart(state.menstrual, raw)
    ;(msDateInput as HTMLInputElement).value = ''
    persist()
    renderAll()
  })

  btnMarkStart.addEventListener('click', () => {
    state.menstrual = recordPeriodStart(state.menstrual, selected)
    persist()
    renderAll()
  })
  btnUnmarkStart.addEventListener('click', () => {
    state.menstrual = removePeriodStart(state.menstrual, selected)
    persist()
    renderAll()
  })

  btnExport.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `planner-export-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  })

  btnImport.addEventListener('click', async () => {
    const file = (importInput as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const txt = await file.text()
      const next = JSON.parse(txt) as AppState
      if (!next || next.version !== 1) return
      state = next
      persist()
      renderAll()
    } catch {
      // ignore
    }
  })

  btnReset.addEventListener('click', () => {
    clearState()
    state = loadState()
    renderAll()
  })

  // 初次默认选中今天
  if (!selected) selected = todayISO()
  // 首次进入同步一次 theme-color
  applyTheme((state.uiTheme ?? 'sakura') as UiTheme)
  renderAll()
}

