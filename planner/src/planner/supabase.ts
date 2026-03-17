import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function mustEnv(name: string): string {
  const v = import.meta.env[name] as string | undefined
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

export const supabase: SupabaseClient = createClient(
  mustEnv('VITE_SUPABASE_URL'),
  mustEnv('VITE_SUPABASE_ANON_KEY'),
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

export type SessionUser = {
  id: string
  email: string
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const { data } = await supabase.auth.getSession()
  const u = data.session?.user
  const email = u?.email
  if (!u?.id || !email) return null
  return { id: u.id, email }
}

export function onAuthChange(cb: (u: SessionUser | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_evt, session) => {
    const u = session?.user
    const email = u?.email
    cb(u?.id && email ? { id: u.id, email } : null)
  })
  return () => data.subscription.unsubscribe()
}

export async function signUp(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export async function signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export async function signOut(): Promise<void> {
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

