export type CityHit = {
  name: string
  admin1?: string
  admin2?: string
  country?: string
  latitude: number
  longitude: number
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(id)
  }
}

export async function searchCity(name: string): Promise<CityHit[]> {
  const q = encodeURIComponent(name.trim())
  if (!q) return []
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=6&language=zh&format=json`
  const data = await fetchJson<{ results?: Array<any> }>(url)
  const list = (data.results ?? []).map((r) => ({
    name: String(r.name ?? ''),
    admin1: r.admin1 ? String(r.admin1) : undefined,
    admin2: r.admin2 ? String(r.admin2) : undefined,
    country: r.country ? String(r.country) : undefined,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
  }))
  return list.filter((x) => x.name && Number.isFinite(x.latitude) && Number.isFinite(x.longitude))
}

export async function reverseCity(lat: number, lon: number): Promise<CityHit | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${encodeURIComponent(
    String(lat),
  )}&longitude=${encodeURIComponent(String(lon))}&language=zh&format=json`
  const data = await fetchJson<{ results?: Array<any> }>(url)
  const r = (data.results ?? [])[0]
  if (!r) return null
  const hit: CityHit = {
    name: String(r.name ?? ''),
    admin1: r.admin1 ? String(r.admin1) : undefined,
    admin2: r.admin2 ? String(r.admin2) : undefined,
    country: r.country ? String(r.country) : undefined,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
  }
  if (!hit.name || !Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) return null
  return hit
}

export async function fetchFeelsLikeC(lat: number, lon: number): Promise<number | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
    String(lat),
  )}&longitude=${encodeURIComponent(String(lon))}&current=apparent_temperature&timezone=auto`
  const data = await fetchJson<{ current?: { apparent_temperature?: number } }>(url)
  const v = data.current?.apparent_temperature
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function formatCity(hit: CityHit): string {
  const parts = [hit.name]
  // 常见：区/市 + 省
  if (hit.admin2 && hit.admin2 !== hit.name) parts.push(hit.admin2)
  if (hit.admin1 && hit.admin1 !== hit.admin2 && hit.admin1 !== hit.name) parts.push(hit.admin1)
  return parts.filter(Boolean).join(' · ')
}

