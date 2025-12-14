import { NextApiRequest, NextApiResponse } from "next"
import { getRoom, listRooms } from "../../lib/cache"

export default async function publicRooms(
  _: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const allRoomIds = await listRooms()
    const publicRoomsData = []

    // Fetch all rooms in parallel for better performance
    const roomPromises = allRoomIds.map(roomId => getRoom(roomId))
    const rooms = await Promise.all(roomPromises)

    for (const room of rooms) {
      if (room && room.isPublic) {
        publicRoomsData.push({
          id: room.id,
          ownerName: room.ownerName || "Anonymous",
          memberCount: room.users.length,
        })
      }
    }

    res.json({ rooms: publicRoomsData })
  } catch (error) {
    console.error("Failed to fetch public rooms:", error)
    res.status(500).json({ error: "Failed to fetch public rooms" })
  }
}
