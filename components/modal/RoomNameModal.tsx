"use client"
import { FC, useState } from "react"
import Modal from "../modal/Modal"
import InputText from "../input/InputText"
import Button from "../action/Button"

interface Props {
  show: boolean
  onSubmit: (name: string, isPublic: boolean) => void
}

const RoomNameModal: FC<Props> = ({ show, onSubmit }) => {
  const [name, setName] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Room name is required")
      return
    }
    if (trimmedName.length > 50) {
      setError("Room name must be 50 characters or less")
      return
    }
    onSubmit(trimmedName, isPublic)
  }

  return (
    <Modal 
      title="Welcome! Set up your room" 
      show={show} 
      close={() => {
        // Intentionally empty - prevent closing without submitting room setup
        // Room creators must provide a name and visibility setting
      }}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2">
            Room Name <span className="text-red-400">*</span>
          </label>
          <InputText
            value={name}
            placeholder="Enter a name for this room"
            onChange={(value) => {
              setName(value)
              setError("")
            }}
            required
          />
          {error && (
            <p className="text-red-400 text-sm mt-1">{error}</p>
          )}
          <p className="text-dark-400 text-xs mt-1">
            This name will be shown to other users
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2">
            Room Visibility
          </label>
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-3 p-3 rounded-lg border border-dark-700/50 cursor-pointer hover:bg-dark-800/50 transition-colors">
              <input
                type="radio"
                name="visibility"
                checked={!isPublic}
                onChange={() => setIsPublic(false)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium text-dark-200">Private Room</div>
                <div className="text-sm text-dark-400">
                  Only accessible to users who know the room ID
                </div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg border border-dark-700/50 cursor-pointer hover:bg-dark-800/50 transition-colors">
              <input
                type="radio"
                name="visibility"
                checked={isPublic}
                onChange={() => setIsPublic(true)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium text-dark-200">Public Room</div>
                <div className="text-sm text-dark-400">
                  Visible on the main page for anyone to join
                </div>
              </div>
            </label>
          </div>
        </div>

        <Button
          tooltip="Create Room"
          className="w-full px-4 py-2.5 font-medium mt-2"
          actionClasses="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 shadow-lg hover:shadow-xl"
          onClick={handleSubmit}
        >
          Create Room
        </Button>
      </div>
    </Modal>
  )
}

export default RoomNameModal
