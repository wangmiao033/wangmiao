import type { AppState } from './types'
import { supabase, type SessionUser } from './supabase'

export type SyncState = {
  remoteUpdatedAt: string | null
  pulling: boolean
  pushing: boolean
  lastError: string | null
}

export async function pullPlannerState(user: SessionUser): Promise<{ ok: true; state: AppState | null; remoteUpdatedAt: string | null } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('planner_states')
    .select('state, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return { ok: false, message: error.message }
  if (!data) return { ok: true, state: null, remoteUpdatedAt: null }
  return { ok: true, state: (data.state ?? null) as AppState | null, remoteUpdatedAt: (data.updated_at ?? null) as string | null }
}

export async function pushPlannerState(user: SessionUser, state: AppState): Promise<{ ok: true; remoteUpdatedAt: string | null } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('planner_states')
    .upsert({ user_id: user.id, version: state.version ?? 1, state }, { onConflict: 'user_id' })
    .select('updated_at')
    .single()

  if (error) return { ok: false, message: error.message }
  return { ok: true, remoteUpdatedAt: (data?.updated_at ?? null) as string | null }
}

export function createSyncController(opts: {
  getUser: () => SessionUser | null
  getLocalState: () => AppState
  setLocalState: (next: AppState) => void
  persistLocal: () => void
  onSyncState?: (s: SyncState) => void
}): {
  pullNow: () => Promise<void>
  schedulePush: () => void
  flushPush: () => Promise<void>
  getSyncState: () => SyncState
} {
  let sync: SyncState = { remoteUpdatedAt: null, pulling: false, pushing: false, lastError: null }
  let pushTimer: number | null = null
  let queued = false

  function emit(): void {
    opts.onSyncState?.(sync)
  }

  async function pullNow(): Promise<void> {
    const user = opts.getUser()
    if (!user) return
    sync = { ...sync, pulling: true, lastError: null }
    emit()
    const res = await pullPlannerState(user)
    if (!res.ok) {
      sync = { ...sync, pulling: false, lastError: res.message }
      emit()
      return
    }
    sync = { ...sync, pulling: false, remoteUpdatedAt: res.remoteUpdatedAt }
    emit()
    if (!res.state) return

    // 简化冲突策略：云端有数据就覆盖本地（首版）
    // 兜底：用户仍可用“导出 JSON”备份
    opts.setLocalState(res.state)
    opts.persistLocal()
  }

  async function flushPush(): Promise<void> {
    const user = opts.getUser()
    if (!user) return
    if (!queued) return
    queued = false
    if (pushTimer) {
      window.clearTimeout(pushTimer)
      pushTimer = null
    }

    sync = { ...sync, pushing: true, lastError: null }
    emit()
    const res = await pushPlannerState(user, opts.getLocalState())
    if (!res.ok) {
      sync = { ...sync, pushing: false, lastError: res.message }
      emit()
      return
    }
    sync = { ...sync, pushing: false, remoteUpdatedAt: res.remoteUpdatedAt }
    emit()
  }

  function schedulePush(): void {
    if (!opts.getUser()) return
    queued = true
    if (pushTimer) return
    // 节流：2 秒合并一次写回
    pushTimer = window.setTimeout(() => void flushPush(), 2000)
  }

  function getSyncState(): SyncState {
    return sync
  }

  return { pullNow, schedulePush, flushPush, getSyncState }
}

