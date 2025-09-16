import { RoomState } from "./types"

// In-memory stores
const rooms = new Map<string, RoomState>()
let userCount = 0

export const getRoom = async (roomId: string): Promise<RoomState | null> => {
  return rooms.get(roomId) ?? null
}

export const roomExists = async (roomId: string): Promise<number> => {
  // Keep Redis-like return type (0/1) for compatibility
  return rooms.has(roomId) ? 1 : 0
}

export const setRoom = async (roomId: string, data: RoomState): Promise<"OK"> => {
  rooms.set(roomId, data)
  return "OK"
}

export const deleteRoom = async (roomId: string): Promise<number> => {
  return rooms.delete(roomId) ? 1 : 0
}

export const listRooms = async (): Promise<string[]> => {
  return Array.from(rooms.keys())
}

export const countRooms = async (): Promise<number> => {
  return rooms.size
}

export const countUsers = async (): Promise<number> => {
  return userCount
}

export const incUsers = async (): Promise<number> => {
  userCount += 1
  return userCount
}

export const decUsers = async (): Promise<number> => {
  userCount = Math.max(0, userCount - 1)
  return userCount
}

export const wipeCache = async (): Promise<"OK"> => {
  rooms.clear()
  userCount = 0
  return "OK"
}