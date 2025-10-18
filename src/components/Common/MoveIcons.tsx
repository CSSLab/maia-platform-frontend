import React from 'react'
import { Tooltip } from 'react-tooltip'

interface IconProps {
  tooltipId?: string
  size?: 'small' | 'medium' | 'large'
  className?: string
  onClick?: () => void
}

const getSizeClasses = (size: 'small' | 'medium' | 'large') => {
  switch (size) {
    case 'small':
      return 'h-3 w-3 text-[8px]'
    case 'medium':
      return 'h-4 w-4 text-xxs'
    case 'large':
      return 'h-5 w-5 text-xs'
    default:
      return 'h-4 w-4 text-xxs'
  }
}

export const BlunderIcon: React.FC<IconProps> = ({
  tooltipId = 'blunder-tooltip',
  size = 'medium',
  className = '',
  onClick,
}) => {
  const sizeClasses = getSizeClasses(size)
  const id = `${tooltipId}-${Math.random().toString(36).substr(2, 9)}`

  const handleClick = (event: React.MouseEvent | React.KeyboardEvent) => {
    if (onClick) {
      event.stopPropagation()
      onClick()
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick(e)
          }
        }}
        className={`ml-1 flex select-none items-center justify-center rounded-full bg-red-500 font-bold text-white ${sizeClasses} ${className} ${onClick ? 'cursor-pointer hover:bg-red-600' : ''}`}
        data-tooltip-id={id}
        onClick={handleClick}
      >
        ??
      </div>
      <Tooltip
        id={id}
        content="Blunder"
        place="top"
        delayShow={300}
        className="z-50 !bg-black !px-2 !py-1 !text-xs"
      />
    </>
  )
}

export const InaccuracyIcon: React.FC<IconProps> = ({
  tooltipId = 'inaccuracy-tooltip',
  size = 'medium',
  className = '',
  onClick,
}) => {
  const sizeClasses = getSizeClasses(size)
  const id = `${tooltipId}-${Math.random().toString(36).substr(2, 9)}`

  const handleClick = (event: React.MouseEvent | React.KeyboardEvent) => {
    if (onClick) {
      event.stopPropagation() // Prevent event bubbling to parent move
      onClick()
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick(e)
          }
        }}
        className={`ml-1 flex select-none items-center justify-center rounded-full bg-yellow-500 font-bold text-white ${sizeClasses} ${className} ${onClick ? 'cursor-pointer hover:bg-yellow-600' : ''}`}
        data-tooltip-id={id}
        onClick={handleClick}
      >
        ?!
      </div>
      <Tooltip
        id={id}
        content="Inaccuracy"
        place="top"
        delayShow={300}
        className="z-50 !bg-black !px-2 !py-1 !text-xs"
      />
    </>
  )
}

export const ExcellentIcon: React.FC<IconProps> = ({
  tooltipId = 'excellent-tooltip',
  size = 'medium',
  className = '',
  onClick,
}) => {
  const sizeClasses = getSizeClasses(size)
  const id = `${tooltipId}-${Math.random().toString(36).substr(2, 9)}`

  const handleClick = (event: React.MouseEvent | React.KeyboardEvent) => {
    if (onClick) {
      event.stopPropagation() // Prevent event bubbling to parent move
      onClick()
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick(e)
          }
        }}
        className={`ml-1 flex select-none items-center justify-center rounded-full bg-green-500 font-bold text-white ${sizeClasses} ${className} ${onClick ? 'cursor-pointer hover:bg-green-600' : ''}`}
        data-tooltip-id={id}
        onClick={handleClick}
      >
        !
      </div>
      <Tooltip
        id={id}
        content="Excellent"
        place="top"
        delayShow={300}
        className="z-50 !bg-black !px-2 !py-1 !text-xs"
      />
    </>
  )
}

export const MoveClassificationIcon: React.FC<{
  classification: {
    blunder: boolean
    inaccuracy: boolean
    excellent: boolean
    bestMove: boolean
  }
  size?: 'small' | 'medium' | 'large'
  className?: string
  onClick?: () => void
}> = ({ classification, size = 'medium', className = '', onClick }) => {
  if (classification.blunder) {
    return <BlunderIcon size={size} className={className} onClick={onClick} />
  }
  if (classification.inaccuracy) {
    return (
      <InaccuracyIcon size={size} className={className} onClick={onClick} />
    )
  }
  if (classification.excellent) {
    return <ExcellentIcon size={size} className={className} onClick={onClick} />
  }
  return null
}
