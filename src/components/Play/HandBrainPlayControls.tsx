/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/alt-text */
import { useState } from 'react'
import { PieceSymbol } from 'chess.ts'

import { BaseGame, Color } from 'src/types'
import { ResignationConfirmModal } from 'src/components'

const pieceTypes: PieceSymbol[] = ['k', 'q', 'r', 'b', 'n', 'p']

const pieceColorMap: { [key: string]: string } = {
  wp: 'white pawn',
  wk: 'white king',
  wq: 'white queen',
  wr: 'white rook',
  wb: 'white bishop',
  wn: 'white knight',
  bp: 'black pawn',
  bk: 'black king',
  bq: 'black queen',
  br: 'black rook',
  bb: 'black bishop',
  bn: 'black knight',
}

interface Props {
  game: BaseGame
  isBrain: boolean
  color: Color
  movablePieceTypes: PieceSymbol[]
  selectedPiece?: PieceSymbol
  playerActive: boolean
  gameOver: boolean
  selectPiece: (selectedPiece: PieceSymbol) => void
  resign?: () => void
  offerDraw?: () => void
  playAgain?: () => void
  simulateMaiaTime?: boolean
  setSimulateMaiaTime?: (value: boolean) => void
}

export const HandBrainPlayControls: React.FC<Props> = ({
  game,
  playerActive,
  gameOver,
  isBrain,
  color,
  selectedPiece,
  movablePieceTypes,
  selectPiece,
  resign,
  offerDraw,
  playAgain,
  simulateMaiaTime,
  setSimulateMaiaTime,
}: Props) => {
  const [showResignConfirm, setShowResignConfirm] = useState(false)

  const handleResignClick = () => {
    setShowResignConfirm(true)
  }

  const handleConfirmResign = () => {
    if (resign) {
      resign()
    }
  }
  const status = playerActive
    ? isBrain
      ? selectedPiece
        ? 'Waiting for hand'
        : 'Select a piece'
      : selectedPiece
        ? 'Your turn'
        : 'Waiting for brain'
    : 'Waiting for opponent'

  return (
    <div className="flex w-full flex-col">
      <div id="play-controls" className="flex h-full flex-col">
        {gameOver ? (
          <div className="flex flex-col gap-3 p-4">
            {game.id ? (
              <button
                onClick={() => {
                  window.open(
                    `/analysis/${game.id}/${isBrain ? 'brain' : 'hand'}`,
                    '_blank',
                  )
                }}
                className="flex items-center justify-center rounded border border-glassBorder bg-glass px-4 py-2 text-sm font-semibold text-white/90 transition-colors duration-200 hover:bg-glass-hover"
              >
                ANALYZE GAME
              </button>
            ) : null}
            {playAgain ? (
              <button
                onClick={playAgain}
                className="flex w-full items-center justify-center rounded border border-glassBorder bg-glass px-4 py-2 text-sm font-semibold tracking-wide text-white/90 transition-colors duration-200 hover:bg-glass-hover"
              >
                PLAY AGAIN
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="bg-transparent px-4 py-3">
              <div className="space-y-1 text-center">
                <p
                  className={`text-sm font-semibold uppercase tracking-wider ${
                    playerActive ? 'text-white' : 'text-white/60'
                  }`}
                >
                  {status}
                </p>
                <p className="text-xs font-medium text-white/70">
                  {isBrain ? 'You are the brain' : 'You are the hand'}
                </p>
              </div>
            </div>

            <div className="bg-transparent px-4 py-2">
              {isBrain ? (
                <div className="flex flex-col gap-3">
                  <p className="text-center text-xs font-semibold uppercase tracking-wide text-white/70">
                    SELECT PIECE
                  </p>
                  <div className="mx-auto grid max-w-full grid-cols-6 gap-2 md:max-w-48 md:grid-cols-3">
                    {pieceTypes.map((p) => {
                      const isSelectable =
                        movablePieceTypes.indexOf(p) !== -1 &&
                        playerActive &&
                        !selectedPiece

                      return (
                        <button
                          key={p}
                          onClick={() => selectPiece(p)}
                          disabled={!isSelectable}
                          className={`flex h-10 w-10 items-center justify-center rounded transition-colors duration-200 md:h-12 md:w-12 ${
                            isSelectable
                              ? 'border border-glassBorder bg-glass-strong hover:bg-glass-stronger'
                              : 'cursor-not-allowed bg-glass opacity-40'
                          }`}
                        >
                          <img
                            src={`/assets/pieces/${pieceColorMap[color[0] + p]}.svg`}
                            className="h-5 w-5 md:h-6 md:w-6"
                            alt={pieceColorMap[color[0] + p]}
                          />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-center text-xs font-medium uppercase tracking-wider text-white/70">
                    SELECTED PIECE
                  </p>
                  <div className="flex h-16 w-16 items-center justify-center">
                    {selectedPiece ? (
                      <div className="flex items-center justify-center rounded border border-glassBorder bg-glass-strong p-2">
                        <img
                          src={`/assets/pieces/${pieceColorMap[color[0] + selectedPiece]}.svg`}
                          className="h-12 w-12"
                          alt={pieceColorMap[color[0] + selectedPiece]}
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-glassBorder bg-glass">
                        <span className="text-xs text-white/40">...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {simulateMaiaTime !== undefined && setSimulateMaiaTime && (
              <div className="bg-transparent px-4 py-3">
                <div className="flex flex-col gap-2">
                  <p className="text-center text-xs font-medium uppercase tracking-wider text-white/70">
                    Maia Thinking Time
                  </p>
                  <div className="flex overflow-hidden rounded border border-glassBorder bg-glass">
                    <button
                      className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                        !simulateMaiaTime
                          ? 'bg-glass-stronger text-white'
                          : 'text-white/70 hover:bg-glass-strong hover:text-white'
                      }`}
                      onClick={() => setSimulateMaiaTime(false)}
                    >
                      Instant
                    </button>
                    <button
                      className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                        simulateMaiaTime
                          ? 'bg-glass-stronger text-white'
                          : 'text-white/70 hover:bg-glass-strong hover:text-white'
                      }`}
                      onClick={() => setSimulateMaiaTime(true)}
                    >
                      Human-like
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 px-4 py-3">
              <div className="flex flex-col gap-3">
                {offerDraw && (
                  <button
                    onClick={offerDraw}
                    disabled={!playerActive}
                    className={`w-full rounded border border-glassBorder px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                      playerActive
                        ? 'bg-glass text-white/90 hover:bg-glass-hover'
                        : 'cursor-not-allowed bg-white/5 text-white/40'
                    }`}
                  >
                    OFFER DRAW
                  </button>
                )}

                <div className="flex justify-center">
                  <button
                    onClick={handleResignClick}
                    disabled={!resign || !playerActive}
                    className={`rounded px-3 py-1 text-xs font-medium transition-colors duration-200 ${
                      resign && playerActive
                        ? 'text-rose-300 hover:bg-rose-500/10 hover:text-rose-200'
                        : 'cursor-not-allowed text-white/30'
                    }`}
                  >
                    Resign
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <ResignationConfirmModal
        isOpen={showResignConfirm}
        onClose={() => setShowResignConfirm(false)}
        onConfirm={handleConfirmResign}
      />
    </div>
  )
}
