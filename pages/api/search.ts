import type { NextApiRequest, NextApiResponse } from "next"
import { execFile } from "node:child_process"

type YtResult = {
  id: string
  title: string
  url: string
  duration?: number
  thumbnails?: { url: string; width?: number; height?: number }[]
}

function limitInt(v: string | number | undefined, def = 8, min = 1, max = 20) {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function withTimeout<T>(p: Promise<T>, ms: number, msg = "timeout"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      }
    )
  })
}

async function searchYouTubeAPI(q: string, limit: number, key: string): Promise<YtResult[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/search")
  url.searchParams.set("part", "snippet")
  url.searchParams.set("type", "video")
  url.searchParams.set("maxResults", String(limit))
  url.searchParams.set("q", q)
  url.searchParams.set("key", key)

  const r = await withTimeout(fetch(url.toString()), 5000, "ytapi_timeout")
  if (!r.ok) throw new Error(`ytapi_http_${r.status}`)
  const data = await r.json()
  const items: any[] = Array.isArray(data?.items) ? data.items : []
  return items
    .map((it: any) => {
      const id = it?.id?.videoId
      const sn = it?.snippet
      if (!id || !sn?.title) return null
      const thumbs = sn?.thumbnails
        ? Object.values(thumbsFromSnippet(sn.thumbnails))
        : undefined
      return {
        id,
        title: sn.title,
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnails: thumbs,
      } as YtResult
    })
    .filter(Boolean) as YtResult[]
}

function thumbsFromSnippet(thumbs: any): Record<string, { url: string; width?: number; height?: number }> {
  const out: Record<string, { url: string; width?: number; height?: number }> = {}
  for (const [k, v] of Object.entries<any>(thumbs || {})) {
    if (v?.url) out[k] = { url: v.url, width: v.width, height: v.height }
  }
  return out
}

async function searchPiped(q: string, limit: number): Promise<YtResult[]> {
  const instances = [
    "https://pipedapi.kavin.rocks",
    "https://piped.video",
    "https://piped.mha.fi",
    "https://piped-api.garudalinux.org",
  ]
  const controller = new AbortController()

  for (const base of instances) {
    try {
      const url = new URL("/search", base)
      url.searchParams.set("q", q)
      // Piped returns a mix; we’ll filter to videos and slice to limit
      const r = await withTimeout(
        fetch(url.toString(), { signal: controller.signal }),
        5000,
        "piped_timeout"
      )
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

function runExec(cmd: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, { stdout, stderr }))
      resolve({ stdout, stderr })
    })
  })
}

function mapYtdlpLine(obj: any): YtResult | null {
  const id = obj?.id
  const title = obj?.title
  if (!id || !title) return null
  const url = obj?.webpage_url || `https://www.youtube.com/watch?v=${id}`
  const duration = typeof obj?.duration === "number" ? obj.duration : undefined
  const thumbs = Array.isArray(obj?.thumbnails)
    ? obj.thumbnails.map((t: any) => ({ url: t.url, width: t.width, height: t.height }))
    : obj?.thumbnail
      ? [{ url: obj.thumbnail }]
      : undefined
  return { id, title, url, duration, thumbnails: thumbs }
}

async function searchYtDlp(q: string, limit: number): Promise<YtResult[]> {
  const term = `ytsearch${limit}:${q}`

  // Try per-entry JSON (-j) with IPv4
  try {
    const { stdout } = await runExec("yt-dlp", ["--force-ipv4", "-j", term, "--no-warnings"])
    const results = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("{") && l.endsWith("}"))
      .map((l) => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .map(mapYtdlpLine)
      .filter((r): r is YtResult => !!r)
    if (results.length) return results
  } catch {
    // ignore, try fallback
  }

  // Fallback: use --print format (still IPv4)
  try {
    const fmt = "%(id)s\t%(title)s\t%(webpage_url)s\t%(duration)s\t%(thumbnail)s"
    const { stdout } = await runExec("yt-dlp", ["--force-ipv4", "--print", fmt, term, "--no-warnings"])
    const results: YtResult[] = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [id, title, url, durationStr, thumb] = line.split("\t")
        if (!id || !title) return null
        const urlFinal = url || `https://www.youtube.com/watch?v=${id}`
        const duration = Number.isFinite(Number(durationStr)) ? Number(durationStr) : undefined
        const thumbnails = thumb ? [{ url: thumb }] : undefined
        return { id, title, url: urlFinal, duration, thumbnails }
      })
      .filter(Boolean) as YtResult[]
    return results
  } catch {
    return []
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = (req.query.q || "").toString().trim()
  if (!q) return res.status(400).json({ error: "Missing q" })
  const limit = limitInt(req.query.limit, 8, 1, 20)

  // Cache a bit at the edge/CDN if available
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate")

  try {
    // 1) Preferred: Official YouTube Data API (set env YT_API_KEY)
    const ytKey = process.env.YT_API_KEY || process.env.YOUTUBE_API_KEY
    if (ytKey) {
      try {
        const results = await searchYouTubeAPI(q, limit, ytKey)
        if (results.length) return res.json({ results, source: "youtube_api" })
      } catch (e) {
        // fall through to piped/yt-dlp
      }
    }

    // 2) Fallback: Piped API (no key needed)
    try {
      const piped = await searchPiped(q, limit)
      if (piped.length) return res.json({ results: piped, source: "piped" })
    } catch {
      // continue
    }

    // 3) Last resort: yt-dlp (may fail in restricted/DNS-broken envs)
    const dl = await searchYtDlp(q, limit)
    if (dl.length) return res.json({ results: dl, source: "yt-dlp" })

    return res.status(502).json({ error: "no_results", detail: "All search methods failed or returned empty." })
  } catch (err: any) {
    console.error("search endpoint failed", err)
    return res.status(500).json({
      error: "search_failed",
      detail: err?.message || "unknown_error",
    })
  }
}