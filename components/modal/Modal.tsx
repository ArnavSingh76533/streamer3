import Button from "../action/Button"
import { FC, ReactNode } from "react"
import IconClose from "../icon/IconClose"
import { Tooltip } from "react-tooltip"

interface Props {
  title: ReactNode
  show: boolean
  close: () => void
  children?: ReactNode
  hideCloseButtons?: boolean // Optional: hide the close buttons
}

const Modal: FC<Props> = ({ title, show, close, children, hideCloseButtons = false }) => {
  if (!show) {
    return <></>
  }

  return (
    <div className={"absolute top-0 left-0 h-full w-full z-40"}>
      <div
        onMouseDownCapture={(e) => {
          if (!hideCloseButtons) {
            e.preventDefault()
            e.stopPropagation()
            close()
          }
        }}
        onTouchStartCapture={(e) => {
          if (!hideCloseButtons) {
            e.preventDefault()
            e.stopPropagation()
            close()
          }
        }}
        className={"absolute top-0 left-0 h-full w-full bg-black/60 backdrop-blur-sm"}
      />
      <div className={"flex justify-center h-full items-center p-4"}>
        <div className={"relative bg-dark-800 shadow-2xl rounded-xl z-50 min-w-[30%] max-w-2xl w-full border border-dark-700/50"}>
          <div
            className={
              "flex justify-between items-center p-4 border-b border-dark-700/50"
            }
          >
            <div className={"px-2"}>
              <h2 className={"text-xl font-semibold text-primary-400"}>{title}</h2>
            </div>
            {!hideCloseButtons && (
              <Button 
                tooltip={"Close modal"} 
                id={"closeModal1"} 
                onClick={close}
                actionClasses={"hover:bg-dark-700 active:bg-dark-600"}
              >
                <IconClose />
              </Button>
            )}
          </div>
          <div className={"p-6"}>{children}</div>
          {!hideCloseButtons && (
            <div
              className={
                "flex justify-end items-center p-4 border-t border-dark-700/50"
              }
            >
              <Button
                tooltip={"Close modal"}
                id={"closeModal2"}
                className={"px-4 py-2"}
                actionClasses={"bg-dark-700 hover:bg-dark-600 active:bg-dark-500"}
                onClick={close}
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </div>

      <Tooltip 
        anchorId={"closeModal1"} 
        style={{
          backgroundColor: "var(--dark-700)",
          borderRadius: "0.5rem",
          padding: "0.5rem 0.75rem",
          fontSize: "0.875rem",
        }}
      />
      <Tooltip 
        anchorId={"closeModal2"}
        style={{
          backgroundColor: "var(--dark-700)",
          borderRadius: "0.5rem",
          padding: "0.5rem 0.75rem",
          fontSize: "0.875rem",
        }}
      />
    </div>
  )
}

export default Modal
