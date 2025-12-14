import * as socketIo from "socket.io"
import { Server } from "socket.io"
import { NextApiRequest, NextApiResponse } from "next"
import { ClientToServerEvents, ServerToClientEvents } from "../../lib/socket"
import {
  decUsers,
  deleteRoom,
  getRoom,
  incUsers,
  roomExists,
  setRoom,
} from "../../lib/cache"
import { createNewRoom, createNewUser, updateLastSync } from "../../lib/room"
import { Playlist, RoomState, UserState, ChatMessage, MediaElement } from "../../lib/types"
import { isUrl } from "../../lib/utils"
import { getDefaultImg, getDefaultSrc } from "../../lib/env"

/**
 * Helper function to create a MediaElement from a URL
 * @param url - The media URL to wrap
 * @returns MediaElement with a single source and no subtitles
 */
const createMediaElement = (url: string): MediaElement => ({
  src: [{ src: url, resolution: "" }],
  sub: [],
})

type RoomLogger = (...props: Parameters<typeof console.log>) => void

const ROOM_EMPTY_TTL_MS = 60_000
const roomDeletionTimers = new Map<
  string,
  { timer: ReturnType<typeof setTimeout>; token: symbol }
>()

const cancelRoomDeletion = (roomId: string) => {
  const entry = roomDeletionTimers.get(roomId)
  if (entry) {
    clearTimeout(entry.timer)
    roomDeletionTimers.delete(roomId)
  }
}

const scheduleRoomDeletion = (roomId: string, log: RoomLogger) => {
  cancelRoomDeletion(roomId)
  const token = Symbol(roomId)
  const timer = setTimeout(async () => {
    try {
      const activeBefore = roomDeletionTimers.get(roomId)
      if (!activeBefore || activeBefore.token !== token) {
        return
      }
      const room = await getRoom(roomId)
      const activeAfter = roomDeletionTimers.get(roomId)
      if (
        !activeAfter ||
        activeAfter.token !== token ||
        room === null ||
        room.users.length !== 0
      ) {
        return
      }
      await deleteRoom(roomId)
      log("deleted empty room after grace period")
    } catch (err) {
      console.error("failed to delete room", roomId, err)
    } finally {
      const entry = roomDeletionTimers.get(roomId)
      if (entry?.token === token) {
        roomDeletionTimers.delete(roomId)
      }
    }
  }, ROOM_EMPTY_TTL_MS)

  roomDeletionTimers.set(roomId, { timer, token })
}

const ioHandler = (_: NextApiRequest, res: NextApiResponse) => {
  // @ts-ignore
  if (res.socket !== null && "server" in res.socket && !res.socket.server.io) {
    console.log("*First use, starting socket.io")

    const io = new Server<ClientToServerEvents, ServerToClientEvents>(
      // @ts-ignore
      res.socket.server,
      {
        path: "/api/socketio",
      }
    )

    const broadcast = async (room: string | RoomState) => {
      const roomId = typeof room === "string" ? room : room.id

      if (typeof room !== "string") {
        await setRoom(roomId, room)
      } else {
        const d = await getRoom(roomId)
        if (d === null) {
          throw Error("Impossible room state of null for room: " + roomId)
        }
        room = d
      }

      room.serverTime = new Date().getTime()
      io.to(roomId).emit("update", room)
    }

    io.on(
      "connection",
      async (
        socket: socketIo.Socket<ClientToServerEvents, ServerToClientEvents>
      ) => {
        if (
          !("roomId" in socket.handshake.query) ||
          typeof socket.handshake.query.roomId !== "string"
        ) {
          socket.disconnect()
          return
        }

        const roomId = socket.handshake.query.roomId.toLowerCase()
        const log: RoomLogger = (...props) => {
          console.log(
            "[" + new Date().toUTCString() + "][room " + roomId + "]",
            socket.id,
            ...props
          )
        }

        if (!(await roomExists(roomId))) {
          await createNewRoom(roomId, socket.id)
          log("created room")
        } else {
          cancelRoomDeletion(roomId)
        }

        socket.join(roomId)
        await incUsers()
        log("joined")

        await createNewUser(roomId, socket.id)

        // Send initial chat history to the newly joined socket
        {
          const r = await getRoom(roomId)
          if (r) {
            io.to(socket.id).emit("chatHistory", r.chatLog ?? [])
          }
        }

        // Simple chat rate limiting per-socket
        let lastChatAt = 0

        socket.on("disconnect", async () => {
          await decUsers()
          log("disconnected")
          const room = await getRoom(roomId)
          if (room === null) return

          room.users = room.users.filter(
            (user) => user.socketIds[0] !== socket.id
          )
          if (room.users.length === 0) {
            scheduleRoomDeletion(roomId, log)
          } else {
            if (room.ownerId === socket.id) {
              room.ownerId = room.users[0].uid
            }
            await broadcast(room)
          }
        })

        socket.on("setPaused", async (paused) => {
          let room = await getRoom(roomId)
          if (room === null) {
            throw new Error("Setting pause for non existing room:" + roomId)
          }
          log("set paused to", paused)

          room = updateLastSync(room)
          room.targetState.paused = paused
          await broadcast(room)
        })

        socket.on("setLoop", async (loop) => {
          const room = await getRoom(roomId)
          if (room === null) {
            throw new Error("Setting loop for non existing room:" + roomId)
          }
          log("set loop to", loop)

          room.targetState.loop = loop
          await broadcast(updateLastSync(room))
        })

        socket.on("setProgress", async (progress) => {
          const room = await getRoom(roomId)
          if (room === null) {
            throw new Error("Setting progress for non existing room:" + roomId)
          }

          room.users = room.users.map((user) => {
            if (user.socketIds[0] === socket.id) {
              user.player.progress = progress
            }
            return user
          })

          await broadcast(room)
        })

        socket.on("setPlaybackRate", async (playbackRate) => {
          let room = await getRoom(roomId)
          if (room === null) {
            throw new Error(
              "Setting playbackRate for non existing room:" + roomId
            )
          }
          log("set playbackRate to", playbackRate)

          room = updateLastSync(room)
          room.targetState.playbackRate = playbackRate
          await broadcast(room)
        })

        socket.on("seek", async (progress) => {
          const room = await getRoom(roomId)
          if (room === null) {
            throw new Error("Setting progress for non existing room:" + roomId)
          }
          log("seeking to", progress)

          room.targetState.progress = progress
          room.targetState.lastSync = new Date().getTime() / 1000
          await broadcast(room)
        })

        socket.on("playEnded", async () => {
          let room = await getRoom(roomId)
          if (room === null) {
            throw new Error("Play ended for non existing room:" + roomId)
          }
          log("playback ended")

          if (room.targetState.loop) {
            room.targetState.progress = 0
            room.targetState.paused = false
          } else if (
            room.targetState.playlist.currentIndex + 1 <
            room.targetState.playlist.items.length
          ) {
            room.targetState.playing =
              room.targetState.playlist.items[
                room.targetState.playlist.currentIndex + 1
              ]
            room.targetState.playlist.currentIndex += 1
            room.targetState.progress = 0
            room.targetState.paused = false
          } else {
            room.targetState.progress =
              room.users.find((user) => user.socketIds[0] === socket.id)?.player
                .progress || 0
            room.targetState.paused = true
          }
          room.targetState.lastSync = new Date().getTime() / 1000
          await broadcast(room)
        })

        socket.on("playAgain", async () => {
          let room = await getRoom(roomId)
          if (room === null) {
            throw new Error("Play again for non existing room:" + roomId)
          }
          log("play same media again")

          room.targetState.progress = 0
          room.targetState.paused = false
          room.targetState.lastSync = new Date().getTime() / 1000
          await broadcast(room)
        })

        socket.on("playItemFromPlaylist", async (index) => {
          let room = await getRoom(roomId)
          if (room === null) {
            throw new Error("Play ended for non existing room:" + roomId)
          }

          if (index < 0 || index >= room.targetState.playlist.items.length) {
            return log(
              "out of index:",
              index,
              "playlist.length:",
              room.targetState.playlist.items.length
            )
          }

          log("playing item", index, "from playlist")
          room.targetState.playing = room.targetState.playlist.items[index]
          room.targetState.playlist.currentIndex = index
          room.targetState.progress = 0
          room.targetState.lastSync = new Date().getTime() / 1000
          await broadcast(room)
        })

        socket.on("updatePlaylist", async (playlist: Playlist) => {
          const room = await getRoom(roomId)
          if (room === null) {
            throw new Error("Setting playlist for non existing room:" + roomId)
          }
          log("playlist update", playlist)

          if (
            playlist.currentIndex < -1 ||
            playlist.currentIndex >= playlist.items.length
          ) {
            return log(
              "out of index:",
              playlist.currentIndex,
              "playlist.length:",
              playlist.items.length
            )
          }

          room.targetState.playlist = playlist
          await broadcast(room)
        })

        socket.on("updateUser", async (user: UserState) => {
          const room = await getRoom(roomId)
          if (room === null) {
            throw new Error("Setting user for non existing room:" + roomId)
          }
          log("user update", user)

          room.users = room.users.map((u) => {
            if (u.socketIds[0] !== socket.id) {
              return u
            }
            if (u.avatar !== user.avatar) {
              u.avatar = user.avatar
            }
            if (u.name !== user.name) {
              u.name = user.name
            }
            return u
          })

          await broadcast(room)
        })

        socket.on("playUrl", async (url) => {
          const room = await getRoom(roomId)
          if (room === null) {
            throw new Error(
              "Impossible non existing room, cannot send anything:" + roomId
            )
          }
          log("playing url", url)

          if (!isUrl(url)) {
            return
          }

          // Remove default image/video from playlist if it's the only item
          const defaultImg = getDefaultImg()
          const defaultMedia = defaultImg || getDefaultSrc()
          
          if (room.targetState.playlist.items.length === 1) {
            const firstItem = room.targetState.playlist.items[0]
            if (firstItem?.src?.[0]?.src === defaultMedia) {
              // Remove the default item
              room.targetState.playlist.items = []
              log("Removed default media from playlist")
            }
          }

          // Add new video to playlist at position 0
          const newMedia = createMediaElement(url)
          room.targetState.playlist.items.unshift(newMedia)
          
          room.targetState.playing = newMedia
          room.targetState.playlist.currentIndex = 0
          room.targetState.progress = 0
          room.targetState.lastSync = new Date().getTime() / 1000
          room.targetState.paused = false
          await broadcast(room)
        })

        // Add a URL to playlist without immediate playback
        socket.on("addToPlaylist", async (url) => {
          const room = await getRoom(roomId)
          if (room === null) {
            throw new Error(
              "Impossible non existing room, cannot add to playlist:" + roomId
            )
          }
          if (!isUrl(url)) return log("addToPlaylist invalid url", url)
          log("add to playlist", url)

          room.targetState.playlist.items.push(createMediaElement(url))

          await broadcast(room)
        })

        socket.on("fetch", async () => {
          const room = await getRoom(roomId)
          if (room === null) {
            throw new Error(
              "Impossible non existing room, cannot send anything:" + roomId
            )
          }

          room.serverTime = new Date().getTime()
          socket.emit("update", room)
        })

        // ===== Chat events =====
        socket.on("chatMessage", async (text: string) => {
          try {
            const now = Date.now()
            // Basic rate limiting: 1 message every 750ms
            if (now - lastChatAt < 750) return
            lastChatAt = now

            const msgText = (text || "").toString().trim()
            if (!msgText) return
            if (msgText.length > 500) return

            const room = await getRoom(roomId)
            if (room === null) return

            // Find sender's display name
            const sender = room.users.find((u) => u.socketIds[0] === socket.id)
            const name = sender?.name ?? "Anonymous"

            const msg: ChatMessage = {
              id: `${now}-${socket.id}`,
              userId: socket.id,
              name,
              text: msgText,
              ts: now,
            }

            room.chatLog = [...(room.chatLog ?? []), msg].slice(-200)
            await setRoom(roomId, room)

            io.to(roomId).emit("chatNew", msg)
          } catch (e) {
            console.error("chatMessage failed:", e)
          }
        })

        // Room management events
        socket.on("setRoomName", async (name: string) => {
          try {
            const room = await getRoom(roomId)
            if (room === null) return
            
            // Only owner can set room name
            if (room.ownerId !== socket.id) return
            
            const trimmedName = (name || "").toString().trim()
            if (!trimmedName || trimmedName.length > 50) return
            
            room.ownerName = trimmedName
            await broadcast(room)
            log("set room name to", trimmedName)
          } catch (e) {
            console.error("setRoomName failed:", e)
          }
        })

        socket.on("setRoomPublic", async (isPublic: boolean) => {
          try {
            const room = await getRoom(roomId)
            if (room === null) return
            
            // Only owner can set room visibility
            if (room.ownerId !== socket.id) return
            
            room.isPublic = isPublic
            await broadcast(room)
            log("set room public to", isPublic)
          } catch (e) {
            console.error("setRoomPublic failed:", e)
          }
        })
        // =======================
      }
    )

    // @ts-ignore
    res.socket.server.io = io
  }

  res.end()
}

export const config = {
  api: {
    bodyParser: false,
  },
}

export default ioHandler
