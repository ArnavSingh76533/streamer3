import { PlayerState, RoomState } from "./types"
import { getRandomName, getTargetTime } from "./utils"
import { getDefaultSrc, getDefaultImg } from "./env"
import { getRoom, setRoom } from "./cache"

export const updateLastSync = (room: RoomState) => {
  room.targetState.progress = getTargetTime(
    room.targetState.progress,
    room.targetState.lastSync,
    room.targetState.paused,
    room.targetState.playbackRate
  )
  room.targetState.lastSync = new Date().getTime() / 1000
  return room
}

export const createNewUser = async (roomId: string, socketId: string) => {
  const room = await getRoom(roomId)
  if (room === null) {
    throw new Error("Creating user for non existing room:" + roomId)
  }

  const users = room.users
  const wasEmpty = users.length === 0
  let name = getRandomName()
  while (users.some((user) => user.name === name)) {
    name = getRandomName()
  }

  const newUser = {
    avatar: "",
    name,
    player: {
      playing: {
        src: [],
        sub: [],
      },
      paused: false,
      progress: 0,
      playbackRate: 1,
      loop: false,
      volume: 1,
      muted: true,
      fullscreen: false,
      duration: 0,
      error: null,
    } as unknown as PlayerState,
    socketIds: [socketId],
    uid: socketId,
  }

  room.users.push(newUser)

  const shouldReassignOwnership =
    wasEmpty || !users.some((user) => user.uid === room.ownerId)

  if (shouldReassignOwnership) {
    room.ownerId = newUser.uid
  }

  await setRoom(roomId, room)
}

export const createNewRoom = async (roomId: string, socketId: string) => {
  // Use default image if available, otherwise use default video
  const defaultImg = getDefaultImg()
  const defaultMedia = defaultImg || getDefaultSrc()
  const isImage = !!defaultImg
  
  await setRoom(roomId, {
    serverTime: 0,
    commandHistory: [],
    id: roomId,
    ownerId: socketId,
    targetState: {
      playlist: {
        items: [
          {
            src: [{ src: defaultMedia, resolution: "" }],
            sub: [],
            title: isImage ? "Welcome" : undefined,
          },
        ],
        currentIndex: 0,
      },
      playing: {
        src: [{ src: defaultMedia, resolution: "" }],
        sub: [],
        title: isImage ? "Welcome" : undefined,
      },
      paused: isImage, // Pause by default if it's an image
      progress: 0,
      playbackRate: 1,
      loop: false,
      lastSync: new Date().getTime() / 1000,
    },
    users: [],
    // Initialize chat log for in-room chat feature
    chatLog: [],
  })
}
