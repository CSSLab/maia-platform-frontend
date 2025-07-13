import React from 'react'
import { Tooltip } from 'react-tooltip'

interface IconProps {
  tooltipId?: string
  size?: 'small' | 'medium' | 'large'
  className?: string
}

const getSizeClasses = (size: 'small' | 'medium' | 'large') => {
  switch (size) {
    case 'small':
      return 'h-3 w-3 text-[8px]'
    case 'medium':
      return 'h-4 w-4 text-[10px]'
    case 'large':
      return 'h-5 w-5 text-xs'
    default:
      return 'h-4 w-4 text-[10px]'
  }
}

export const BlunderIcon: React.FC<IconProps> = ({
  tooltipId = 'blunder-tooltip',
  size = 'medium',
  className = '',
}) => {
  const sizeClasses = getSizeClasses(size)
  const id = `${tooltipId}-${Math.random().toString(36).substr(2, 9)}`

  return (
    <>
      <div
        className={`ml-1 flex select-none items-center justify-center rounded-full bg-red-500 font-bold text-white ${sizeClasses} ${className}`}
        data-tooltip-id={id}
      >
        ??
      </div>
      <Tooltip
        id={id}
        content="Blunder"
        place="top"
        delayShow={300}
        className="z-50 !bg-background-2 !px-2 !py-1 !text-xs"
      />
    </>
  )
}

export const InaccuracyIcon: React.FC<IconProps> = ({
  tooltipId = 'inaccuracy-tooltip',
  size = 'medium',
  className = '',
}) => {
  const sizeClasses = getSizeClasses(size)
  const id = `${tooltipId}-${Math.random().toString(36).substr(2, 9)}`

  return (
    <>
      <div
        className={`ml-1 flex select-none items-center justify-center rounded-full bg-yellow-500 font-bold text-white ${sizeClasses} ${className}`}
        data-tooltip-id={id}
      >
        ?!
      </div>
      <Tooltip
        id={id}
        content="Inaccuracy"
        place="top"
        delayShow={300}
        className="z-50 !bg-background-2 !px-2 !py-1 !text-xs"
      />
    </>
  )
}

export const ExcellentIcon: React.FC<IconProps> = ({
  tooltipId = 'excellent-tooltip',
  size = 'medium',
  className = '',
}) => {
  const sizeClasses = getSizeClasses(size)
  const id = `${tooltipId}-${Math.random().toString(36).substr(2, 9)}`

  return (
    <>
      <div
        className={`ml-1 flex select-none items-center justify-center rounded-full bg-green-500 font-bold text-white ${sizeClasses} ${className}`}
        data-tooltip-id={id}
      >
        !!
      </div>
      <Tooltip
        id={id}
        content="Excellent"
        place="top"
        delayShow={300}
        className="z-50 !bg-background-2 !px-2 !py-1 !text-xs"
      />
    </>
  )
}

// Unified move classification icon component
export const MoveClassificationIcon: React.FC<{
  classification: {
    blunder: boolean
    inaccuracy: boolean
    excellent: boolean
    bestMove: boolean
  }
  size?: 'small' | 'medium' | 'large'
  className?: string
}> = ({ classification, size = 'medium', className = '' }) => {
  if (classification.blunder) {
    return <BlunderIcon size={size} className={className} />
  }
  if (classification.inaccuracy) {
    return <InaccuracyIcon size={size} className={className} />
  }
  if (classification.excellent) {
    return <ExcellentIcon size={size} className={className} />
  }
  return null
}
