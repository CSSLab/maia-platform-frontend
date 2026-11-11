import React from 'react'
import { Tooltip } from 'react-tooltip'
import type { MoveMark } from 'src/lib/humanBar'

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

/**
 * The marks from the two costs (practical LOG §91, lib/humanBar moveMark):
 * an objective mistake that is still these players' close-to-best try is ?!,
 * the best practical try that isn't Stockfish's move is !?; an inaccuracy is
 * a yellow dot, without a symbol.
 */
const MARKS: Record<MoveMark, { glyph: string; colour: string; tip: string }> =
  {
    '??': {
      glyph: '??',
      colour: 'bg-red-500 hover:bg-red-600',
      tip: 'Blunder',
    },
    '?': {
      glyph: '?',
      colour: 'bg-orange-500 hover:bg-orange-600',
      tip: 'Mistake',
    },
    '?!': {
      glyph: '?!',
      colour: 'bg-yellow-500 hover:bg-yellow-600',
      tip: 'Dubious: a mistake, yet for these players it is about as good a try as any',
    },
    '!?': {
      glyph: '!?',
      colour: 'bg-sky-500 hover:bg-sky-600',
      tip: "Interesting: not Stockfish's move, but these players' best try",
    },
    inaccuracy: {
      glyph: '',
      colour: 'bg-yellow-500 hover:bg-yellow-600',
      tip: 'Inaccuracy',
    },
  }

export const MoveMarkIcon: React.FC<
  IconProps & {
    mark: MoveMark
  }
> = ({ mark, size = 'medium', className = '', onClick }) => {
  const { glyph, colour, tip } = MARKS[mark]
  const id = `mark-tooltip-${Math.random().toString(36).substr(2, 9)}`
  const sizeClasses = glyph
    ? getSizeClasses(size)
    : size === 'small'
      ? 'h-1.5 w-1.5'
      : 'h-2 w-2'
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
        aria-label={tip}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick(e)
          }
        }}
        className={`ml-1 flex select-none items-center justify-center rounded-full font-bold text-white ${colour} ${sizeClasses} ${className} ${onClick ? 'cursor-pointer' : ''}`}
        data-tooltip-id={id}
        onClick={handleClick}
      >
        {glyph}
      </div>
      <Tooltip
        id={id}
        content={tip}
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
  /**
   * The move's mark from the human bars (undefined: none, the site's own
   * classification shows; null: no mark, only the site's ! if excellent).
   */
  mark?: MoveMark | null
  size?: 'small' | 'medium' | 'large'
  className?: string
  onClick?: () => void
}> = ({ classification, mark, size = 'medium', className = '', onClick }) => {
  if (mark !== undefined) {
    if (mark !== null) {
      return (
        <MoveMarkIcon
          mark={mark}
          size={size}
          className={className}
          onClick={onClick}
        />
      )
    }
    return classification.excellent ? (
      <ExcellentIcon size={size} className={className} onClick={onClick} />
    ) : null
  }
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
