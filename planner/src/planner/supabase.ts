import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function env(name: string): string | null {
  const v = import.meta.env[name] as string | undefined
  return v && v.trim() ? v.trim() : null
}

export const supabaseEnabled = !!env('VITE_SUPABASE_URL') && !!env('VITE_SUPABASE_ANON_KEY')

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(env('VITE_SUPABASE_URL')!, env('VITE_SUPABASE_ANON_KEY')!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export type SessionUser = {
  id: string
  email: string
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const u = data.session?.user
  const email = u?.email
  if (!u?.id || !email) return null
  return { id: u.id, email }
}

export function onAuthChange(cb: (u: SessionUser | null) => void): () => void {
  if (!supabase) {
    cb(null)
    return () => undefined
  }
  const { data } = supabase.auth.onAuthStateChange((_evt, session) => {
    const u = session?.user
    const email = u?.email
    cb(u?.id && email ? { id: u.id, email } : null)
  })
  return () => data.subscription.unsubscribe()
}

export async function signUp(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: '云端未配置：缺少 Supabase 环境变量。' }
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export async function signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: '云端未配置：缺少 Supabase 环境变量。' }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

export function adminEmails(): string[] {
  const raw = (import.meta.env.VITE_ADMIN_EMAILS as string | undefined) ?? ''
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.toLowerCase())
}

