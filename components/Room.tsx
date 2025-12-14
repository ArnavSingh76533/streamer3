"use client"
import { FC, useEffect, useState } from "react"
import Player from "./player/Player"
import {
  ClientToServerEvents,
  createClientSocket,
  ServerToClientEvents,
} from "../lib/socket"
import Button from "./action/Button"
import { Socket } from "socket.io-client"
import ConnectingAlert from "./alert/ConnectingAlert"
import PlaylistMenu from "./playlist/PlaylistMenu"
import IconLoop from "./icon/IconLoop"
import InputUrl from "./input/InputUrl"
import UserList from "./user/UserList"
import ChatPanel from "./chat/ChatPanel"
import YoutubeSearch from "./search/YoutubeSearch"
import RoomNameModal from "./modal/RoomNameModal"

interface Props {
  id: string
  initialName?: string
  initialIsPublic?: boolean
}

let connecting = false

const Room: FC<Props> = ({ id, initialName, initialIsPublic }) => {
  const [connected, setConnected] = useState(false)
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null)
  const [url, setUrl] = useState("")
  const [showNameModal, setShowNameModal] = useState(false)
  const [hasSetName, setHasSetName] = useState(false)

  useEffect(() => {
    fetch("/api/socketio").finally(() => {
      if (socket !== null) {
        setConnected(socket.connected)
      } else {
        const newSocket = createClientSocket(id)
        
        const handleConnect = () => {
          setConnected(true)
          
          // If we have initial name/visibility from query params, set them immediately
          if (initialName && !hasSetName) {
            newSocket.emit("setRoomName", initialName)
            newSocket.emit("setRoomPublic", initialIsPublic || false)
            setHasSetName(true)
          }
        }
        
        // Check if user is owner and room needs setup
        const handleUpdate = (room: any) => {
          const isRoomOwner = newSocket.id === room.ownerId
          
          // Show modal if owner and no room name set (and no initial name provided)
          if (isRoomOwner && !room.ownerName && !hasSetName && !initialName) {
            setShowNameModal(true)
          }
        }
        
        newSocket.on("connect", handleConnect)
        newSocket.on("update", handleUpdate)
        
        setSocket(newSocket)
      }
    })

    return () => {
      if (socket !== null) {
        socket.off("connect")
        socket.off("update")
        socket.disconnect()
      }
    }
  }, [id, socket, hasSetName, initialName, initialIsPublic])

  const handleRoomSetup = (name: string, isPublic: boolean) => {
    if (socket) {
      socket.emit("setRoomName", name)
      socket.emit("setRoomPublic", isPublic)
      setShowNameModal(false)
      setHasSetName(true)
    }
  }

  const connectionCheck = () => {
    if (socket !== null && socket.connected) {
      connecting = false
      setConnected(true)
      return
    }
    setTimeout(connectionCheck, 100)
  }

  if (!connected || socket === null) {
    if (!connecting) {
      connecting = true
      connectionCheck()
    }
    return (
      <div className={"flex justify-center"}>
        <ConnectingAlert />
      </div>
    )
  }

  return (
    <>
      <RoomNameModal show={showNameModal} onSubmit={handleRoomSetup} />
      
      <div className={"flex flex-col sm:flex-row gap-2"}>
        <div className={"grow"}>
          <Player roomId={id} socket={socket} />

          <div className={"flex flex-row gap-2 p-2 bg-dark-900/50 rounded-lg border border-dark-700/50 mt-2"}>
            <Button
              tooltip={"Do a forced manual sync"}
              className={"px-3 py-2 flex flex-row gap-2 items-center"}
              actionClasses={"bg-dark-800 hover:bg-dark-700 active:bg-dark-600 border border-dark-700/50"}
              onClick={() => {
                console.log("Fetching update", socket?.id)
                socket?.emit("fetch")
              }}
            >
              <IconLoop className={"hover:animate-spin"} />
              <div className={"hidden-below-sm"}>Manual sync</div>
            </Button>
            <InputUrl
              className={"grow"}
              url={url}
              placeholder={"Play url now"}
              tooltip={"Play given url now"}
              onChange={setUrl}
              onSubmit={() => {
                console.log("Requesting", url, "now")
                socket?.emit("playUrl", url)
                setUrl("")
              }}
            >
              Play
            </InputUrl>
          </div>

          {/* Chat + YouTube Search */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2 mt-2">
            <ChatPanel socket={socket} />
            <YoutubeSearch socket={socket} />
          </div>

          <UserList socket={socket} />
        </div>

        <PlaylistMenu socket={socket} />
      </div>
    </>
  )
}

export default Room