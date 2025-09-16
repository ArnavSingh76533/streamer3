import type { NextApiRequest, NextApiResponse } from "next"

type YtResult = {
  id: string
  title: string
  url: string
  duration?: number
  thumbnails?: { url: string; width?: number; height?: number }[]
}

function normalizeQueryParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

function limitInt(v: string | number | undefined, def = 8, min = 1, max = 20) {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function thumbsFromSnippet(thumbs: any): { url: string; width?: number; height?: number }[] | undefined {
  const out: { url: string; width?: number; height?: number }[] = []
  for (const v of Object.values<any>(thumbs || {})) {
    if (v?.url) out.push({ url: v.url, width: v.width, height: v.height })
  }
  return out.length ? out : undefined
}

async function searchYouTubeAPI(q: string, limit: number, key: string): Promise<YtResult[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/search")
  url.searchParams.set("part", "snippet")
  url.searchParams.set("type", "video")
  url.searchParams.set("maxResults", String(limit))
  url.searchParams.set("q", q)
  url.searchParams.set("key", key)

  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`ytapi_http_${r.status}`)
  const data = await r.json()
  const items: any[] = Array.isArray(data?.items) ? data.items : []
  return items
    .map((it: any) => {
      const id = it?.id?.videoId
      const sn = it?.snippet
      if (!id || !sn?.title) return null
      return {
        id,
        title: sn.title,
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnails: thumbsFromSnippet(sn.thumbnails),
      } as YtResult
    })
    .filter(Boolean) as YtResult[]
}

async function searchPipedServer(q: string, limit: number): Promise<YtResult[]> {
  // Try a few public instances
  const instances = [
    "https://pipedapi.kavin.rocks",
    "https://piped.video",
    "https://piped.mha.fi",
    "https://piped-api.garudalinux.org",
  ]
  for (const base of instances) {
    try {
      const url = new URL("/search", base)
      url.searchParams.set("q", q)
      const r = await fetch(url.toString())
      if (!r.ok) continue
      const data = await r.json()
      const items: any[] = Array.isArray(data?.items) ? data.items : []
      const results = items
        .filter((it) => it?.type?.toLowerCase() === "video" && it?.id && it?.title)
        .slice(0, limit)
        .map((it) => {
          const id = it.id
          return {
            id,
            title: it.title,
            url: `https://www.youtube.com/watch?v=${id}`,
            duration: typeof it.duration === "number" ? it.duration : undefined,
            thumbnails: it.thumbnail ? [{ url: it.thumbnail }] : undefined,
          } as YtResult
        })
      if (results.length) return results
    } catch {
      // try next instance
    }
  }
  return []
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const qParam = normalizeQueryParam(req.query.q)
  const q = (qParam || "").toString().trim()
  if (!q) return res.status(400).json({ error: "Missing q" })

  const limitParam = normalizeQueryParam(req.query.limit)
  const limit = limitInt(limitParam, 8, 1, 20)

  // Edge cache (if available)
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate")

  try {
    const ytKey = process.env.YT_API_KEY || process.env.YOUTUBE_API_KEY
    if (ytKey) {
      try {
        const results = await searchYouTubeAPI(q, limit, ytKey)
        if (results.length) return res.json({ results, source: "youtube_api" })
      } catch {
        // fall back to piped
      }
    }

    const piped = await searchPipedServer(q, limit)
    if (piped.length) return res.json({ results: piped, source: "piped" })

    return res
      .status(502)
      .json({ error: "no_results", detail: "All server-side search methods failed or returned empty." })
  } catch (err: any) {
    console.error("search endpoint failed", err)
    return res.status(500).json({
      error: "search_failed",
      detail: err?.message || "unknown_error",
    })
  }
}