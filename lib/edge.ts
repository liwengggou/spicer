function projectRefFromUrl(url: string) {
  try {
    const u = new URL(url)
    const host = u.host
    const ref = host.split(".")[0]
    return ref
  } catch {
    return ""
  }
}

export function edgeUrl(fn: string) {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_url || ""
  const ref = projectRefFromUrl(supaUrl)
  return `https://${ref}.functions.supabase.co/${fn}`
}

export async function callEdge(fn: string, body: unknown, headers?: Record<string, string>) {
  const url = edgeUrl(fn)
  const h = { "Content-Type": "application/json", ...(headers || {}) }
  const res = await fetch(url, { method: "POST", headers: h, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`edge_${fn}_error_${res.status}`)
  return res.json()
}
