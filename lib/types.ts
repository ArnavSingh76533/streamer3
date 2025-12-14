export interface Subtitle {
  src: string
  lang: string
}

export interface MediaOption {
  src: string
  resolution: string
}

export interface MediaElement {
  title?: string
  sub: Subtitle[]
  src: MediaOption[]
}

export interface Playlist {
  items: MediaElement[]
  currentIndex: number
}

export interface TargetState {
  playlist: Playlist
  playing: MediaElement
  paused: boolean
  progress: number
  playbackRate: number
  loop: boolean
  lastSync: number
}

export interface PlayerState extends TargetState {
  currentSrc: MediaOption
  currentSub: Subtitle
  volume: number
  muted: boolean
  fullscreen: boolean
  error: any
  duration: number
}

export interface UserState {
  socketIds: string[]
  uid: string
  name: string
  avatar: string
  player: PlayerState
}

export enum Command {
  play = "play",
  pause = "pause",
  seek = "seek",
  playbackRate = "playbackRate",
  playSrc = "playSrc",
}

export interface CommandLog {
  command: Command
  userId: string
  target?: MediaElement | Playlist | string | number
  time: number
}

/**
 * Chat message structure for in-room chat
 */
export interface ChatMessage {
  id: string       // unique id per message
  userId: string   // sender socket/user id
  name: string     // sender display name
  text: string     // message text
  ts: number       // timestamp (ms since epoch)
}

export interface RoomState {
  serverTime: number
  id: string
  ownerId: string
  ownerName?: string // Name provided by room creator
  isPublic?: boolean // Whether room is public or private
  users: UserState[]
  targetState: TargetState
  commandHistory: CommandLog[]
  chatLog?: ChatMessage[] // optional to keep backward compatibility
}
