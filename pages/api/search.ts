import type { NextApiRequest, NextApiResponse } from "next"
import { execFile } from "node:child_process"

type YtResult = {
  id: string
  title: string
  url: string
  duration?: number
  thumbnails?: { url: string; width?: number; height?: number }[]
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = (req.query.q || "").toString().trim()
  if (!q) return res.status(400).json({ error: "Missing q" })

  const limit = Math.max(1, Math.min(20, parseInt((req.query.limit || "10").toString(), 10) || 10))
  const term = `ytsearch${limit}:${q}`

  execFile(
    "yt-dlp",
    ["-J", term, "--no-warnings"],
    { maxBuffer: 10 * 1024 * 1024 },
    (err, stdout, stderr) => {
      if (err) {
        console.error("yt-dlp search failed", err, stderr)
        return res.status(500).json({ error: "search_failed" })
      }
      try {
        const data = JSON.parse(stdout)
        const entries = Array.isArray(data?.entries) ? data.entries : []
        const results: YtResult[] = entries
          .filter((e: any) => e?.id && e?.title)
          .map((e: any) => ({
            id: e.id,
            title: e.title,
            url: `https://www.youtube.com/watch?v=${e.id}`,
            duration: typeof e.duration === "number" ? e.duration : undefined,
            thumbnails: Array.isArray(e.thumbnails)
              ? e.thumbnails.map((t: any) => ({ url: t.url, width: t.width, height: t.height }))
              : undefined,
          }))
        res.json({ results })
      } catch (parseErr) {
        console.error("Failed to parse yt-dlp JSON", parseErr)
        res.status(500).json({ error: "parse_failed" })
      }
    }
  )
}