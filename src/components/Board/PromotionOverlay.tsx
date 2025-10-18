/* eslint-disable @typescript-eslint/no-explicit-any */
import { useContext } from 'react'

import { Color } from 'src/types'
import { TreeControllerContext } from 'src/contexts'

interface Props {
  player: Color
  file: string
  onPlayerSelectPromotion: (piece: string) => void
}

export const PromotionOverlay: React.FC<Props> = ({
  player,
  onPlayerSelectPromotion,
}: Props) => {
  const { orientation } = useContext(TreeControllerContext)

  const pieces = ['q', 'n', 'r', 'b']
  const flipped = orientation == 'black'
  const pieceColor = player === 'black' ? 'black' : 'white'
  const pieceNames: Record<string, string> = {
    q: 'queen',
    n: 'knight',
    r: 'rook',
    b: 'bishop',
  }

  if (flipped) {
    pieces.reverse()
  }

  return (
    <>
      <div className="absolute left-0 top-0 z-10 flex h-full w-full flex-col items-center justify-center bg-backdrop/90">
        <div className="flex h-16 flex-row items-center justify-center overflow-hidden rounded border border-glass-border backdrop-blur-[1px]">
          {pieces.map((piece) => {
            const asset = `${pieceColor} ${pieceNames[piece] ?? piece}`

            return (
              <button
                key={piece}
                onClick={() => onPlayerSelectPromotion(piece)}
                className="flex h-16 w-16 items-center justify-center bg-glass-strong hover:bg-glass-stronger"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="h-16 w-16"
                  src={`/assets/pieces/${asset}.svg`}
                  alt={piece}
                />
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
