import { FC } from "react"
import IconClipboard from "../icon/IconClipboard"

interface Props {
  value: string
  className?: string
}

const InputClipboardCopy: FC<Props> = ({ value, className }) => {
  return (
    <div
      className={"rounded-lg flex flex-row items-center bg-dark-900 border border-dark-700/50 overflow-hidden " + className}
    >
      <input
        className={"rounded-l-lg grow bg-transparent p-3 outline-none " + className}
        value={value}
        type={"text"}
        readOnly={true}
        onClick={(event) => {
          const target = event.target as HTMLInputElement
          target.select()
        }}
      />
      <button
        className={
          "px-4 py-3 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 flex flex-row items-center gap-2 cursor-copy font-medium transition-all duration-200"
        }
        data-tooltip-content={"Click to copy"}
        type={"button"}
        onClick={() => {
          navigator.clipboard
            .writeText(value)
            .then(() => {})
            .catch((error) => {
              console.error("Failed to copy", error)
            })
        }}
      >
        <IconClipboard /> Copy
      </button>
    </div>
  )
}

export default InputClipboardCopy
