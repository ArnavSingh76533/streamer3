import { FC, ReactNode, useState } from "react"
import IconClose from "../icon/IconClose"
import Button from "../action/Button"
import classNames from "classnames"

export interface AlertProps {
  canClose?: boolean
  className?: string
  children?: ReactNode
}

const Alert: FC<AlertProps> = ({
  canClose = true,
  className = "",
  children,
}) => {
  const [closed, setClosed] = useState(false)
  if (closed) {
    return <></>
  }

  return (
    <div
      className={classNames(
        "rounded-lg bg-dark-800/90 backdrop-blur-sm border border-dark-700/50 p-3 flex gap-2 items-center flex-row justify-between shadow-lg",
        className
      )}
    >
      <div className={"flex flex-row gap-2 items-center"}>{children}</div>
      {canClose && (
        <Button 
          tooltip={"Dismiss"} 
          onClick={() => setClosed(true)}
          actionClasses="hover:bg-dark-700 active:bg-dark-600"
        >
          <IconClose />
        </Button>
      )}
    </div>
  )
}

export default Alert
