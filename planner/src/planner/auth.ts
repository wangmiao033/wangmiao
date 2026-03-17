import { signIn, signOut, signUp, type SessionUser } from './supabase'

type AuthUi = {
  root: HTMLDivElement
  open: () => void
  close: () => void
  render: (u: SessionUser | null) => void
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

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase()
}

export function createAuthUi(): AuthUi {
  let mode: 'signin' | 'signup' = 'signin'
  let user: SessionUser | null = null

  const root = el('div', { class: 'wm-overlay', 'data-visible': '0' }) as HTMLDivElement
  const popup = el('div', { class: 'wm-popup' })
  const title = el('div', { class: 'wm-popup-title' }, ['账号'])
  const hint = el('div', { class: 'wm-popup-date' }, ['登录后可开启云同步与后台。'])
  const content = el('div', { class: 'wm-popup-blocks' })
  const errorBox = el('div', { class: 'wm-auth-error' }, [''])

  const emailInput = el('input', { class: 'wm-input', placeholder: '邮箱' }) as HTMLInputElement
  const passInput = el('input', { class: 'wm-input', placeholder: '密码（>= 6 位）', type: 'password' }) as HTMLInputElement

  const btnPrimary = el('button', { class: 'wm-popup-btn', type: 'button' }, [''])
  const btnSwitch = el('button', { class: 'wm-btn', type: 'button' }, [''])
  const btnLogout = el('button', { class: 'wm-btn wm-btn-danger', type: 'button' }, ['退出登录'])
  const btnClose = el('button', { class: 'wm-btn', type: 'button' }, ['关闭'])

  function setVisible(v: boolean): void {
    root.dataset.visible = v ? '1' : '0'
    if (!v) errorBox.textContent = ''
  }

  function setMode(m: 'signin' | 'signup'): void {
    mode = m
    btnPrimary.textContent = m === 'signin' ? '登录' : '注册'
    btnSwitch.textContent = m === 'signin' ? '没有账号？去注册' : '已有账号？去登录'
  }

  async function doPrimary(): Promise<void> {
    errorBox.textContent = ''
    const email = normalizeEmail(emailInput.value)
    const password = passInput.value
    if (!email || !password) {
      errorBox.textContent = '请输入邮箱与密码。'
      return
    }
    const res = mode === 'signin' ? await signIn(email, password) : await signUp(email, password)
    if (!res.ok) {
      errorBox.textContent = res.message
      return
    }
    // 登录成功会由外部 auth listener 更新 user
  }

  btnPrimary.addEventListener('click', () => void doPrimary())
  passInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void doPrimary()
  })
  btnSwitch.addEventListener('click', () => setMode(mode === 'signin' ? 'signup' : 'signin'))
  btnLogout.addEventListener('click', () => void signOut())
  btnClose.addEventListener('click', () => setVisible(false))

  root.addEventListener('click', (e) => {
    if (e.target === root) setVisible(false)
  })

  content.append(
    el('div', { class: 'wm-popup-block' }, [emailInput]),
    el('div', { class: 'wm-popup-block' }, [passInput]),
    el('div', { class: 'wm-popup-block' }, [errorBox]),
  )

  const row = el('div', { class: 'wm-row wm-row-wrap' })
  row.append(btnSwitch, btnLogout, btnClose)

  popup.append(title, hint, content, btnPrimary, row)
  root.append(popup)

  setMode('signin')

  return {
    root,
    open: () => setVisible(true),
    close: () => setVisible(false),
    render: (u: SessionUser | null) => {
      user = u
      btnLogout.style.display = user ? 'inline-flex' : 'none'
      setMode('signin')
      if (user) {
        hint.textContent = `已登录：${user.email}`
      } else {
        hint.textContent = '登录后可开启云同步与后台。'
      }
    },
  }
}

