import Layout from "../components/Layout"
import { useState } from "react"
import InputText from "../components/input/InputText"
import Button from "../components/action/Button"
import { useRouter } from "next/router"
import { Tooltip } from "react-tooltip"
import useSWR from "swr"
import RoomNameModal from "../components/modal/RoomNameModal"

interface PublicRoom {
  id: string
  ownerName: string
  memberCount: number
}

export default function Index() {
  const router = useRouter()
  const { data } = useSWR("/api/stats", (url) =>
    fetch(url).then((r) => r.json())
  )
  const { data: publicRoomsData } = useSWR<{ rooms: PublicRoom[] }>(
    "/api/public-rooms",
    (url) => fetch(url).then((r) => r.json()),
    { refreshInterval: 5000 } // Refresh every 5 seconds
  )
  const [room, setRoom] = useState("")
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false)

  const publicRooms = publicRoomsData?.rooms || []

  const handleCreateRoom = async (name: string, isPublic: boolean) => {
    try {
      // Generate a room ID first
      const response = await fetch("/api/generate")
      const { roomId } = await response.json()
      
      if (
        typeof roomId === "string" &&
        roomId.length >= 4 &&
        roomId.match(/^[a-z]{4,}$/)
      ) {
        // Navigate to room with name and visibility as query params
        await router.push({
          pathname: `/room/${roomId}`,
          query: { name, isPublic: isPublic.toString() }
        })
      } else {
        throw Error("Invalid roomId generated: " + roomId)
      }
    } catch (error) {
      console.error("Failed to generate new roomId", error)
    }
  }

  return (
    <Layout meta={{ robots: "index, archive, follow" }} showNavbar={false}>
      <RoomNameModal 
        show={showCreateRoomModal} 
        allowClose={true}
        onSubmit={(name, isPublic) => {
          setShowCreateRoomModal(false)
          handleCreateRoom(name, isPublic)
        }}
        onClose={() => setShowCreateRoomModal(false)}
      />
      <div className={"self-center flex justify-center items-center min-h-[70vh]"}>
        <div className="flex flex-col gap-6 max-w-4xl w-full m-8">
          {/* Main join/create form */}
          <form
            className={
              "flex flex-col gap-6 justify-center rounded-xl shadow-2xl p-8 bg-gradient-to-br from-dark-800 to-dark-900 border border-dark-700/50"
            }
            onSubmit={async (e) => {
              e.preventDefault()

              if (room.length >= 4) {
                await router.push("/room/" + room)
              }
            }}
          >
            <div className="text-center">
              <h1 className={"text-3xl font-bold bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent mb-2"}>
                Welcome to Streamer
              </h1>
              <p className="text-dark-400 text-sm">Join or create a room to watch together</p>
            </div>
            
            <InputText
              value={room}
              placeholder={"Enter a room ID"}
              onChange={(value) =>
                setRoom(value.toLowerCase().replace(/[^a-z]/g, ""))
              }
            />
            
            <div className={"flex gap-3 justify-end"}>
              <Button
                tooltip={"Create a new personal room"}
                className={"px-4 py-2.5 font-medium"}
                actionClasses={
                  "bg-accent-600 hover:bg-accent-700 active:bg-accent-800 shadow-lg hover:shadow-xl"
                }
                onClick={() => {
                  setShowCreateRoomModal(true)
                }}
              >
                Generate room
              </Button>
              <Button
                tooltip={room.length < 4 ? "Invalid room id" : "Join room"}
                className={"px-4 py-2.5 font-medium"}
                actionClasses={
                  room.length >= 4
                    ? "bg-primary-600 hover:bg-primary-700 active:bg-primary-800 shadow-lg hover:shadow-xl hover:shadow-glow"
                    : "bg-dark-700 hover:bg-dark-600 active:bg-red-700 cursor-not-allowed opacity-50"
                }
                disabled={room.length < 4}
                type={"submit"}
              >
                Join room
              </Button>
            </div>
            
            <div className={"mt-2 pt-4 border-t border-dark-700/50"}>
              <small className={"text-dark-400"}>
                <div className="font-medium text-dark-300 mb-1">Currently active:</div>
                <div className={"flex flex-row gap-4 text-sm"}>
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-primary-500 rounded-full"></span>
                    <span>{data?.rooms || 0} Rooms</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-accent-500 rounded-full"></span>
                    <span>{data?.users || 0} Users</span>
                  </div>
                </div>
              </small>
            </div>
          </form>

          {/* Public Rooms List */}
          {publicRooms.length > 0 && (
            <div className="rounded-xl shadow-2xl p-6 bg-gradient-to-br from-dark-800 to-dark-900 border border-dark-700/50">
              <h2 className="text-2xl font-bold text-primary-400 mb-4">Public Rooms</h2>
              <div className="grid gap-3">
                {publicRooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-dark-800/50 border border-dark-700/50 hover:bg-dark-800 transition-colors cursor-pointer"
                    onClick={() => router.push("/room/" + room.id)}
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-dark-200">{room.ownerName}&apos;s Room</div>
                      <div className="text-sm text-dark-400">Room ID: {room.id}</div>
                    </div>
                    <div className="flex items-center gap-2 text-dark-300">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                      <span className="text-sm">{room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Tooltip
        style={{
          backgroundColor: "var(--dark-700)",
          borderRadius: "0.5rem",
          padding: "0.5rem 0.75rem",
          fontSize: "0.875rem",
        }}
      />
    </Layout>
  )
}
