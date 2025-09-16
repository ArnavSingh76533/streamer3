import type { NextApiRequest, NextApiResponse } from "next"
import { execFile } from "node:child_process"

type YtResult = {
  id: string
  title: string
  url: string
  duration?: number
  thumbnails?: { url: string; width?: number; height?: number }[]
}

function run(cmd: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, { stdout, stderr }))
      resolve({ stdout, stderr })
    })
  })
}

function mapLineJsonToResult(obj: any): YtResult | null {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = (req.query.q || "").toString().trim()
  if (!q) return res.status(400).json({ error: "Missing q" })

  const limit = Math.max(1, Math.min(20, parseInt((req.query.limit || "8").toString(), 10) || 8))
  const term = `ytsearch${limit}:${q}`

  try {
    // Attempt A: Use IPv4 and per-entry JSON (-j). This avoids the “API page” failure mode.
    const argsA = ["--force-ipv4", "-j", term, "--no-warnings"]
    const { stdout } = await run("yt-dlp", argsA)

    const resultsA: YtResult[] = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("{") && line.endsWith("}"))
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .map((obj) => mapLineJsonToResult(obj))
      .filter((r): r is YtResult => !!r)

    if (resultsA.length > 0) {
      return res.json({ results: resultsA })
    }

    // Fallback B: Print fields in a simple, parseable format (still forces IPv4).
    const fmt = "%(id)s\t%(title)s\t%(webpage_url)s\t%(duration)s\t%(thumbnail)s"
    const argsB = ["--force-ipv4", "--print", fmt, term, "--no-warnings"]
    const outB = await run("yt-dlp", argsB)
    const resultsB: YtResult[] = outB.stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [id, title, url, durationStr, thumb] = line.split("\t")
        if (!id || !title) return null
        const urlFinal = url || `https://www.youtube.com/watch?v=${id}`
        const duration = Number.isFinite(Number(durationStr)) ? Number(durationStr) : undefined
        const thumbnails = thumb ? [{ url: thumb }] : undefined
        return { id, title, url: urlFinal, duration, thumbnails } as YtResult
      })
      .filter(Boolean) as YtResult[]

    return res.json({ results: resultsB })
  } catch (err: any) {
    console.error("yt-dlp search failed", err)
    return res.status(500).json({
      error: "search_failed",
      detail: err?.stderr || err?.message || "unknown_error",
    })
  }
}