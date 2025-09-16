"use client"
import { FC, useState } from "react"
import { Socket } from "socket.io-client"
import { ClientToServerEvents, ServerToClientEvents } from "../../lib/socket"

type Result = {
  id: string
  title: string
  url: string
  duration?: number
  thumbnails?: { url: string; width?: number; height?: number }[]
}

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null
}

const YoutubeSearch: FC<Props> = ({ socket }) => {
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Result[]>([])
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    const query = q.trim()
    if (!query) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`)
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || "Failed to search")
      setResults(data.results || [])
    } catch (e: any) {
      setError(e.message || "Failed to search")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          className="input flex-1 bg-neutral-800 p-2 rounded-md outline-none"
          placeholder="Search YouTube (e.g., titanium sia)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") search()
          }}
        />
        <button onClick={search} className="btn bg-primary-700 hover:bg-primary-600 px-3 rounded-md">
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      <div className="grid gap-2">
        {results.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-2 rounded-md border">
            {r.thumbnails?.[0]?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.thumbnails[0].url} alt="" className="w-16 h-9 object-cover rounded-sm" />
            )}
            <div className="flex-1 overflow-hidden">
              <div className="truncate">{r.title}</div>
              <div className="opacity-60 text-xs truncate">{r.url}</div>
            </div>
            <button
              className="btn bg-primary-800 hover:bg-primary-700 px-3 rounded-md"
              onClick={() => socket?.emit("playUrl", r.url)}
            >
              Play
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default YoutubeSearch
