/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/alt-text */
import { PieceSymbol } from 'chess.ts'

import { BaseGame, Color } from 'src/types'

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
    <div className="flex h-full w-full flex-col border-white/40 bg-background-1">
      <div id="play-controls" className="flex h-full flex-col">
        {gameOver ? (
          <div className="flex flex-col gap-2 p-4">
            {game.id ? (
              <button
                onClick={() => {
                  window.open(
                    `/analysis/${game.id}/${isBrain ? 'brain' : 'hand'}`,
                    '_blank',
                  )
                }}
                className="flex items-center justify-center rounded border border-engine-2/20 bg-engine-3/5 px-4 py-2 text-sm font-semibold text-engine-1 transition-colors duration-200 hover:border-engine-2/50 hover:bg-engine-3/10"
              >
                ANALYZE GAME
              </button>
            ) : null}
            {playAgain ? (
              <button
                onClick={playAgain}
                className="flex w-full items-center justify-center rounded border border-human-2/20 bg-human-3/5 px-4 py-2 text-sm font-semibold tracking-wider text-human-1 transition-colors duration-200 hover:border-human-2/50 hover:bg-human-3/10"
              >
                PLAY AGAIN
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {/* Status Section */}
            <div className="border-b border-white/10 bg-background-1 p-3">
              <div className="space-y-1 text-center">
                <p
                  className={`text-sm font-semibold uppercase tracking-wider ${
                    playerActive ? 'text-human-1' : 'text-secondary'
                  }`}
                >
                  {status}
                </p>
                <p className="text-xs font-medium text-secondary/70">
                  {isBrain ? 'You are the brain' : 'You are the hand'}
                </p>
              </div>
            </div>

            {/* Piece Selection or Display */}
            <div className="border-b border-white/5 bg-human-3/5 p-4">
              {isBrain ? (
                <div className="flex flex-col gap-3">
                  <p className="text-center text-xs font-semibold uppercase tracking-wide text-human-2">
                    SELECT PIECE
                  </p>
                  <div className="mx-auto grid max-w-full grid-cols-6 gap-1 md:max-w-48 md:grid-cols-3 md:gap-2">
                    {pieceTypes.map((p) => (
                      <button
                        key={p}
                        onClick={() => selectPiece(p)}
                        disabled={
                          movablePieceTypes.indexOf(p) == -1 ||
                          !playerActive ||
                          !!selectedPiece
                        }
                        className={`flex h-10 w-10 items-center justify-center border transition-colors duration-200 md:h-12 md:w-12 ${
                          movablePieceTypes.indexOf(p) !== -1 &&
                          playerActive &&
                          !selectedPiece
                            ? 'border-white/20 bg-[#f0d9b5] hover:border-white/30 hover:bg-[#e6d0a6]'
                            : 'cursor-not-allowed border-white/5 bg-background-2 opacity-50'
                        }`}
                      >
                        <img
                          src={`/assets/pieces/${pieceColorMap[color[0] + p]}.svg`}
                          className="h-5 w-5 md:h-6 md:w-6"
                          alt={pieceColorMap[color[0] + p]}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-center text-xs font-semibold uppercase tracking-wide text-human-2">
                    SELECTED PIECE
                  </p>
                  <div className="flex h-16 w-16 items-center justify-center">
                    {selectedPiece ? (
                      <div className="border border-white/20 bg-[#f0d9b5] p-2">
                        <img
                          src={`/assets/pieces/${pieceColorMap[color[0] + selectedPiece]}.svg`}
                          className="h-12 w-12"
                          alt={pieceColorMap[color[0] + selectedPiece]}
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center border border-dashed border-white/20 bg-background-2">
                        <span className="text-xs text-secondary/50">...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Maia Timing Toggle */}
            {simulateMaiaTime !== undefined && setSimulateMaiaTime && (
              <div className="border-b border-white/5 bg-human-3/5 p-3">
                <div className="flex flex-col gap-2">
                  <p className="text-center text-xs font-semibold tracking-wider text-human-2">
                    MAIA THINKING TIME
                  </p>
                  <div className="flex overflow-hidden border border-white/10 bg-background-1">
                    <button
                      className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                        !simulateMaiaTime
                          ? 'bg-human-3 text-white'
                          : 'text-primary hover:bg-background-2'
                      }`}
                      onClick={() => setSimulateMaiaTime(false)}
                    >
                      Instant
                    </button>
                    <button
                      className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                        simulateMaiaTime
                          ? 'bg-human-3 text-white'
                          : 'text-primary hover:bg-background-2'
                      }`}
                      onClick={() => setSimulateMaiaTime(true)}
                    >
                      Human-like
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex-1 p-3">
              <div className="flex flex-col gap-2">
                {offerDraw && (
                  <button
                    onClick={offerDraw}
                    disabled={!playerActive}
                    className={`w-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                      playerActive
                        ? 'border-white/10 bg-engine-3/5 text-engine-1 hover:border-white/20 hover:bg-engine-3/10'
                        : 'cursor-not-allowed border-white/5 bg-background-2 text-secondary/40'
                    }`}
                  >
                    OFFER DRAW
                  </button>
                )}

                {/* Resign Button - Smaller and Less Prominent */}
                <div className="flex justify-center">
                  <button
                    onClick={resign}
                    disabled={!resign || !playerActive}
                    className={`rounded px-3 py-1 text-xs font-medium transition-colors duration-200 ${
                      resign && playerActive
                        ? 'text-red-400/80 hover:bg-red-500/5 hover:text-red-300'
                        : 'cursor-not-allowed text-secondary/30'
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
    </div>
  )
}
