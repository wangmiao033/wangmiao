import { supabase, supabaseEnabled, type SessionUser } from './supabase'

type AdminUi = {
  root: HTMLDivElement
  open: () => void
  close: () => void
  refresh: () => Promise<void>
}

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

function jsonPretty(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

export function createAdminUi(opts: { getUser: () => SessionUser | null; isAdmin: () => boolean }): AdminUi {
  const root = el('div', { class: 'wm-overlay', 'data-visible': '0' }) as HTMLDivElement
  const popup = el('div', { class: 'wm-popup wm-admin-popup' })
  const title = el('div', { class: 'wm-popup-title' }, ['后台'])
  const sub = el('div', { class: 'wm-popup-date' }, ['用户 / 统计 / 内容管理（只读）'])

  const tabs = el('div', { class: 'wm-admin-tabs' })
  const tabUsers = el('button', { class: 'wm-btn wm-btn-small', type: 'button' }, ['用户'])
  const tabStats = el('button', { class: 'wm-btn wm-btn-small', type: 'button' }, ['统计'])
  const tabData = el('button', { class: 'wm-btn wm-btn-small', type: 'button' }, ['内容'])
  tabs.append(tabUsers, tabStats, tabData)

  const body = el('div', { class: 'wm-admin-body' })
  const footer = el('div', { class: 'wm-row wm-row-wrap' })
  const btnRefresh = el('button', { class: 'wm-btn wm-btn-primary', type: 'button' }, ['刷新'])
  const btnClose = el('button', { class: 'wm-btn', type: 'button' }, ['关闭'])
  footer.append(btnRefresh, btnClose)

  popup.append(title, sub, tabs, body, footer)
  root.append(popup)

  function setVisible(v: boolean): void {
    root.dataset.visible = v ? '1' : '0'
  }

  root.addEventListener('click', (e) => {
    if (e.target === root) setVisible(false)
  })
  btnClose.addEventListener('click', () => setVisible(false))

  let active: 'users' | 'stats' | 'data' = 'users'
  let selectedUserId: string | null = null

  function setActive(a: typeof active): void {
    active = a
    for (const [btn, key] of [
      [tabUsers, 'users'],
      [tabStats, 'stats'],
      [tabData, 'data'],
    ] as const) {
      if (key === active) btn.classList.add('wm-btn-primary')
      else btn.classList.remove('wm-btn-primary')
    }
  }

  async function renderUsers(): Promise<void> {
    body.innerHTML = ''
    const note = el('div', { class: 'wm-hint' }, ['仅管理员可见。'])
    body.append(note, el('div', { class: 'wm-empty' }, ['加载中…']))

    if (!supabase || !supabaseEnabled) {
      body.innerHTML = ''
      body.append(note, el('div', { class: 'wm-empty' }, ['云端未配置：缺少 Supabase 环境变量。']))
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, created_at, display_name, role, city')
      .order('created_at', { ascending: false })
      .limit(200)

    body.innerHTML = ''
    body.append(note)
    if (error) {
      body.append(el('div', { class: 'wm-empty' }, [`加载失败：${error.message}`]))
      return
    }

    const list = el('div', { class: 'wm-admin-list' })
    for (const p of data ?? []) {
      const row = el('button', { class: 'wm-admin-row', type: 'button' }, [
        `${p.role === 'admin' ? 'admin' : 'user'} ｜ ${p.display_name ?? '(未命名)'} ｜ ${p.city ?? '-'} ｜ ${String(p.created_at).slice(0, 19)}`,
      ])
      row.addEventListener('click', () => {
        selectedUserId = p.id
        setActive('data')
        void renderData()
      })
      list.append(row)
    }
    body.append(list)
  }

  async function renderStats(): Promise<void> {
    body.innerHTML = ''
    body.append(el('div', { class: 'wm-empty' }, ['加载中…']))

    if (!supabase || !supabaseEnabled) {
      body.innerHTML = ''
      body.append(el('div', { class: 'wm-empty' }, ['云端未配置：缺少 Supabase 环境变量。']))
      return
    }

    // 简化：过去 7 天的事件数 & 去重用户数（近似 DAU）
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data, error } = await supabase
      .from('events')
      .select('created_at, user_id, name')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000)

    body.innerHTML = ''
    if (error) {
      body.append(el('div', { class: 'wm-empty' }, [`加载失败：${error.message}`]))
      return
    }

    const rows = data ?? []
    const users = new Set(rows.map((r) => r.user_id))
    const byName = new Map<string, number>()
    for (const r of rows) byName.set(r.name, (byName.get(r.name) ?? 0) + 1)

    body.append(
      el('div', { class: 'wm-popup-block' }, [`过去7天事件数：${rows.length}`]),
      el('div', { class: 'wm-popup-block' }, [`过去7天活跃用户（近似）：${users.size}`]),
      el('div', { class: 'wm-popup-block' }, ['事件分布：']),
    )

    const list = el('div', { class: 'wm-admin-kv' })
    for (const [k, v] of [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
      list.append(el('div', { class: 'wm-admin-kv-row' }, [el('strong', {}, [k]), ` ${v}`]))
    }
    body.append(list)
  }

  async function renderData(): Promise<void> {
    body.innerHTML = ''
    const u = selectedUserId
    if (!u) {
      body.append(el('div', { class: 'wm-empty' }, ['先在“用户”里点一个用户，才能查看内容。']))
      return
    }
    body.append(el('div', { class: 'wm-empty' }, ['加载中…']))

    if (!supabase || !supabaseEnabled) {
      body.innerHTML = ''
      body.append(el('div', { class: 'wm-empty' }, ['云端未配置：缺少 Supabase 环境变量。']))
      return
    }

    const { data, error } = await supabase
      .from('planner_states')
      .select('state, updated_at, user_id')
      .eq('user_id', u)
      .maybeSingle()

    body.innerHTML = ''
    if (error) {
      body.append(el('div', { class: 'wm-empty' }, [`加载失败：${error.message}`]))
      return
    }
    if (!data) {
      body.append(el('div', { class: 'wm-empty' }, ['该用户还没有云端数据。']))
      return
    }

    body.append(
      el('div', { class: 'wm-popup-block' }, [`user_id：${data.user_id}`]),
      el('div', { class: 'wm-popup-block' }, [`updated_at：${data.updated_at}`]),
    )
    const pre = el('pre', { class: 'wm-admin-pre' }, [jsonPretty(data.state)])
    body.append(pre)
  }

  async function refresh(): Promise<void> {
    if (!opts.getUser()) {
      body.innerHTML = ''
      body.append(el('div', { class: 'wm-empty' }, ['未登录。']))
      return
    }
    if (!opts.isAdmin()) {
      body.innerHTML = ''
      body.append(el('div', { class: 'wm-empty' }, ['你不是管理员账号，无法访问后台。']))
      return
    }
    if (active === 'users') await renderUsers()
    if (active === 'stats') await renderStats()
    if (active === 'data') await renderData()
  }

  tabUsers.addEventListener('click', () => {
    setActive('users')
    void refresh()
  })
  tabStats.addEventListener('click', () => {
    setActive('stats')
    void refresh()
  })
  tabData.addEventListener('click', () => {
    setActive('data')
    void refresh()
  })

  btnRefresh.addEventListener('click', () => void refresh())

  setActive('users')

  return {
    root,
    open: () => {
      setVisible(true)
      void refresh()
    },
    close: () => setVisible(false),
    refresh,
  }
}

