import { useMemo } from 'react'
import type { Color } from 'src/types'
import { Chess } from 'chess.ts'

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      piece: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >
    }
  }
}

type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
type MaterialCount = Record<PieceType, number>

const PIECE_DISPLAY_ORDER: PieceType[] = ['p', 'n', 'b', 'r', 'q']

const PIECE_VALUES: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
}

const STARTING_MATERIAL: { white: MaterialCount; black: MaterialCount } = {
  white: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
  black: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
}

const getPieceLabel = (piece: PieceType): string => {
  const labelMap: Record<PieceType, string> = {
    p: 'pawn',
    n: 'knight',
    b: 'bishop',
    r: 'rook',
    q: 'queen',
    k: 'king',
  }

  return labelMap[piece]
}

const getPieceSpriteClass = (piece: PieceType): string => {
  const spriteMap: Record<PieceType, string> = {
    p: 'pawn',
    n: 'knight',
    b: 'bishop',
    r: 'rook',
    q: 'queen',
    k: 'king',
  }

  return spriteMap[piece]
}

const calculateCapturedPieces = (fen: string) => {
  const chess = new Chess(fen)
  const board = chess.board()

  const currentMaterial: { white: MaterialCount; black: MaterialCount } = {
    white: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    black: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  }

  for (const row of board) {
    for (const square of row) {
      if (!square) continue

      const piece = square.type.toLowerCase() as PieceType
      const color = square.color === 'w' ? 'white' : 'black'
      currentMaterial[color][piece]++
    }
  }

  const captured = {
    white: {} as Partial<Record<PieceType, number>>,
    black: {} as Partial<Record<PieceType, number>>,
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

const calculateMaterialAdvantage = (fen: string) => {
  const chess = new Chess(fen)
  const board = chess.board()

  let whiteTotal = 0
  let blackTotal = 0

  for (const row of board) {
    for (const square of row) {
      if (!square) continue

      const piece = square.type.toLowerCase() as PieceType
      if (square.color === 'w') {
        whiteTotal += PIECE_VALUES[piece]
      } else {
        blackTotal += PIECE_VALUES[piece]
      }
    }
  }

  return { white: whiteTotal, black: blackTotal }
}

export const MaterialBalance = ({
  fen,
  color,
  className = '',
  iconClassName = '',
  textClassName = '',
  pieceFilter,
}: {
  fen?: string
  color: Color
  className?: string
  iconClassName?: string
  textClassName?: string
  pieceFilter?: string
}) => {
  const materialData = useMemo(() => {
    if (!fen) {
      return null
    }

    const capturedPieces = calculateCapturedPieces(fen)
    const materialAdvantage = calculateMaterialAdvantage(fen)
    const myCapturedPieces =
      color === 'white' ? capturedPieces.black : capturedPieces.white
    const opponentCapturedPieces =
      color === 'white' ? capturedPieces.white : capturedPieces.black
    const pieceDifference: Partial<Record<PieceType, number>> = {}

    PIECE_DISPLAY_ORDER.forEach((piece) => {
      const myCount = myCapturedPieces[piece] ?? 0
      const opponentCount = opponentCapturedPieces[piece] ?? 0
      const net = myCount - opponentCount

      if (net > 0) {
        pieceDifference[piece] = net
      }
    })

    const netAdvantage = materialAdvantage.white - materialAdvantage.black
    const advantage =
      netAdvantage === 0
        ? 0
        : netAdvantage > 0
          ? color === 'white'
            ? netAdvantage
            : 0
          : color === 'black'
            ? Math.abs(netAdvantage)
            : 0

    return { pieceDifference, advantage }
  }, [color, fen])

  if (
    !materialData ||
    (Object.keys(materialData.pieceDifference).length === 0 &&
      materialData.advantage === 0)
  ) {
    return null
  }

  const capturedPieceColor = color === 'white' ? 'black' : 'white'
  const capturedPieceFilter =
    (pieceFilter ?? capturedPieceColor === 'black')
      ? 'drop-shadow(0 0 0.8px rgba(255,255,255,0.82)) drop-shadow(0 0 1.5px rgba(255,255,255,0.28))'
      : 'drop-shadow(0 0 0.8px rgba(0,0,0,0.82)) drop-shadow(0 0 1.5px rgba(0,0,0,0.22))'

  return (
    <div className={`flex select-none items-center gap-1 ${className}`.trim()}>
      <div className="flex items-center">
        {PIECE_DISPLAY_ORDER.map((piece) => {
          const count = materialData.pieceDifference[piece] ?? 0

          if (count === 0) {
            return null
          }

          return (
            <div key={piece} className="flex items-center gap-0">
              {Array.from({ length: count }).map((_, index) => (
                <span
                  key={`${piece}-${index}`}
                  className={`cg-wrap !relative !inline-block !h-[1em] !w-[1em] align-middle ${
                    index > 0 ? '-ml-1.5' : ''
                  } ${iconClassName}`.trim()}
                  title={getPieceLabel(piece)}
                >
                  <piece
                    className={`${getPieceSpriteClass(piece)} ${capturedPieceColor}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      filter: capturedPieceFilter,
                    }}
                  />
                </span>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
