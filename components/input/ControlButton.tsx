import { FC, ReactNode } from "react"
import InteractionHandler from "../action/InteractionHandler"
import classNames from "classnames"

interface Props {
  tooltip: string
  className?: string
  onClick: () => void
  interaction: (touch: boolean) => void
  children?: ReactNode
}

const ControlButton: FC<Props> = ({
  tooltip,
  className,
  onClick,
  interaction,
  children,
}) => {
  return (
    <InteractionHandler
      tooltip={tooltip}
      className={classNames(
        "action cursor-pointer rounded-lg p-2.5 select-none transition-all duration-200",
        className
      )}
      onClick={(e, touch) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
        interaction(touch)
      }}
      onMove={(e, touch) => {
        e.preventDefault()
        e.stopPropagation()
        interaction(touch)
      }}
      prevent={true}
    >
      {children}
    </InteractionHandler>
  )
}

export default ControlButton
