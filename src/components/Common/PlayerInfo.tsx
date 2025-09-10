interface PlayerInfoProps {
  name: string
  color: string
  rating?: number
  termination?: string
  showArrowLegend?: boolean
  currentFen?: string
  orientation?: 'white' | 'black'
  clock?: {
    timeInSeconds: number
    isActive: boolean
    lastUpdateTime: number
  }
  rounded?: 'all' | 'top' | 'bottom' | 'none'
}

import { useState, useEffect, useMemo } from 'react'
import { Chess } from 'chess.ts'

type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
type MaterialCount = Record<PieceType, number>

const PIECE_VALUES: Record<string, number> = {
  p: 1, // pawn
  n: 3, // knight
  b: 3, // bishop
  r: 5, // rook
  q: 9, // queen
  k: 0, // king (not counted)
}

const STARTING_MATERIAL: { white: MaterialCount; black: MaterialCount } = {
  white: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
  black: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
}

const calculateCapturedPieces = (fen?: string) => {
  if (!fen) return { white: {}, black: {} }

  const chess = new Chess(fen)
  const board = chess.board()

  // Count current pieces on board
  const currentMaterial: { white: MaterialCount; black: MaterialCount } = {
    white: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    black: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  }

  for (const row of board) {
    for (const square of row) {
      if (square) {
        const piece = square.type.toLowerCase() as PieceType
        const color = square.color === 'w' ? 'white' : 'black'
        currentMaterial[color][piece]++
      }
    }
  }

  // Calculate captured pieces (starting - current)
  const captured = {
    white: {} as Record<string, number>,
    black: {} as Record<string, number>,
  }

  for (const piece of Object.keys(STARTING_MATERIAL.white) as PieceType[]) {
    const whiteCaptured =
      STARTING_MATERIAL.white[piece] - currentMaterial.white[piece]
    const blackCaptured =
      STARTING_MATERIAL.black[piece] - currentMaterial.black[piece]

    if (whiteCaptured > 0) captured.white[piece] = whiteCaptured
    if (blackCaptured > 0) captured.black[piece] = blackCaptured
  }

  return captured
}

const calculateMaterialAdvantage = (
  fen?: string,
): { white: number; black: number } => {
  if (!fen) return { white: 0, black: 0 }

  const chess = new Chess(fen)
  const board = chess.board()

  let whiteTotal = 0
  let blackTotal = 0

  for (const row of board) {
    for (const square of row) {
      if (square) {
        const piece = square.type.toLowerCase()
        const value = PIECE_VALUES[piece] || 0
        if (square.color === 'w') {
          whiteTotal += value
        } else {
          blackTotal += value
        }
      }
    }
  }

  return { white: whiteTotal, black: blackTotal }
}

export const PlayerInfo: React.FC<PlayerInfoProps> = ({
  name,
  rating,
  color,
  termination,
  showArrowLegend = false,
  currentFen,
  orientation = 'white',
  clock,
  rounded = 'all',
}) => {
  const [currentTime, setCurrentTime] = useState<number>(
    clock?.timeInSeconds || 0,
  )

  // Calculate captured pieces and material advantage
  const capturedPieces = useMemo(
    () => calculateCapturedPieces(currentFen),
    [currentFen],
  )
  const materialAdvantage = useMemo(
    () => calculateMaterialAdvantage(currentFen),
    [currentFen],
  )

  // Get pieces captured by this player (pieces of opposite color that were captured)
  const myCapturedPieces =
    color === 'white' ? capturedPieces.black : capturedPieces.white

  // Calculate net material advantage (white total - black total)
  const netAdvantage = materialAdvantage.white - materialAdvantage.black

  // Only show advantage for the side that actually has more material
  const myAdvantage = useMemo(() => {
    if (netAdvantage === 0) return 0

    if (netAdvantage > 0) {
      // White has advantage
      return color === 'white' ? netAdvantage : 0
    } else {
      // Black has advantage
      return color === 'black' ? Math.abs(netAdvantage) : 0
    }
  }, [netAdvantage, color])

  // Map chess pieces to Material UI icons
  const getPieceIcon = (piece: string): string => {
    const iconMap: Record<string, string> = {
      p: 'chess_pawn',
      n: 'chess_knight',
      b: 'chess_bishop',
      r: 'chess_rook',
      q: 'chess', // queen uses 'chess' icon
    }
    return iconMap[piece] || 'chess'
  }

  // Render captured pieces
  const renderCapturedPieces = () => {
    const pieceGroups: React.JSX.Element[] = []

    // Order pieces by value (lowest to highest)
    const orderedPieces = ['p', 'n', 'b', 'r', 'q']

    orderedPieces.forEach((piece) => {
      const count = myCapturedPieces[piece] || 0
      if (count > 0) {
        const piecesOfType: React.JSX.Element[] = []

        for (let i = 0; i < count; i++) {
          piecesOfType.push(
            <span
              key={`${piece}-${i}`}
              className={`material-symbols-outlined material-symbols-filled text-sm text-secondary ${i > 0 ? '-ml-1.5' : ''}`}
              title={`${piece === 'p' ? 'pawn' : piece === 'n' ? 'knight' : piece === 'b' ? 'bishop' : piece === 'r' ? 'rook' : 'queen'}`}
            >
              {getPieceIcon(piece)}
            </span>,
          )
        }

        pieceGroups.push(
          <div key={piece} className="flex items-center gap-0">
            {piecesOfType}
          </div>,
        )
      }
    })

    return pieceGroups
  }

  useEffect(() => {
    if (!clock || !clock.isActive) return

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsedSinceUpdate = (now - clock.lastUpdateTime) / 1000
      const newTime = Math.max(0, clock.timeInSeconds - elapsedSinceUpdate)
      setCurrentTime(newTime)
    }, 100)

    return () => clearInterval(interval)
  }, [clock])

  // Update current time when clock prop changes (new move received)
  useEffect(() => {
    if (clock) {
      setCurrentTime(clock.timeInSeconds)
    }
  }, [clock?.timeInSeconds, clock?.lastUpdateTime])

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const roundedClass =
    rounded === 'top'
      ? 'rounded-t-md'
      : rounded === 'bottom'
        ? 'rounded-b-md'
        : rounded === 'none'
          ? ''
          : 'rounded-md'

  return (
    <div
      className={`flex h-10 w-full items-center justify-between ${roundedClass} border border-glassBorder bg-glass px-4 backdrop-blur-md`}
    >
      <div className="flex items-center gap-1.5">
        <div
          className={`h-2.5 w-2.5 rounded-full ${color === 'white' ? 'bg-white' : 'border bg-black'}`}
        />
        <p className="text-sm">
          {name ?? 'Unknown'}{' '}
          <span className="text-xs text-secondary">
            {rating ? `(${rating})` : null}
          </span>
        </p>
        {currentFen && (
          <div className="ml-1 flex select-none items-center gap-1">
            <div className="flex items-center">{renderCapturedPieces()}</div>
            {myAdvantage > 0 && (
              <span className="text-xxs font-medium text-secondary">
                +{myAdvantage}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        {showArrowLegend && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-0.5">
              <span className="material-symbols-outlined !text-xxs text-human-3">
                arrow_outward
              </span>
              <span className="text-xxs text-human-3">Most Human Move</span>
            </div>
            <div className="flex items-center gap-0.5">
              <span className="material-symbols-outlined !text-xxs text-engine-3">
                arrow_outward
              </span>
              <span className="text-xxs text-engine-3">Best Engine Move</span>
            </div>
          </div>
        )}

        {clock && (
          <div
            className={`flex items-center rounded bg-glass px-2 py-1 ${
              clock.isActive ? 'bg-primary text-black' : ''
            }`}
          >
            <span
              className={`font-mono text-xs font-medium ${
                clock.isActive ? '' : 'text-secondary/80'
              } ${currentTime < 60 && clock.isActive ? 'text-red-700' : ''}`}
            >
              {formatTime(currentTime)}
            </span>
          </div>
        )}

        {termination === color ? (
          <p className="text-engine-3">1</p>
        ) : termination === undefined ? (
          <></>
        ) : termination !== 'none' ? (
          <p className="text-human-3">0</p>
        ) : (
          <p className="text-secondary">½</p>
        )}
      </div>
    </div>
  )
}
