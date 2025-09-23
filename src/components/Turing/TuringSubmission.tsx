import { motion } from 'framer-motion'
import { useCallback, useContext, useEffect, useState } from 'react'

import { TuringControllerContext } from 'src/contexts'

export const TuringSubmission = ({ rating }: { rating: number }) => {
  const { game, submitGuess, getNewGame, commentController } = useContext(
    TuringControllerContext,
  )
  const [comment, setComment] = commentController
  const [selected, setSelected] = useState<'white' | 'black' | null>(null)

  const handleSubmit = useCallback(() => {
    if (selected) {
      submitGuess(selected, comment, rating)
    }
  }, [selected, submitGuess, comment, rating])

  useEffect(() => {
    setSelected(null)
  }, [game])

  if (game?.result)
    return (
      <div className="flex flex-col gap-5 border-t border-glassBorder bg-transparent p-3">
        <h2 className="text-2xl">
          Guess {game.result.correct ? 'correct' : 'incorrect'}, <br />
          {game.result.bot} was the bot
        </h2>
        <div className="-mt-1 flex flex-col">
          <h3>
            {game.result.timeControl} · {game.result.gameType}
          </h3>
          <div className="flex flex-row items-center gap-1">
            <p className="text-lg">●</p>
            {game.result.whitePlayer.title && (
              <span className="font-bold">{game.result.whitePlayer.title}</span>
            )}
            {game.result.whitePlayer.name}
            <span>({game.result.whitePlayer.rating})</span>
            {game.result.bot === 'white' ? '🤖' : undefined}
          </div>
          <div className="flex flex-row items-center gap-1">
            <p className="text-lg">○</p>
            {game.result.blackPlayer.title && (
              <span className="font-bold">{game.result.blackPlayer.title}</span>
            )}
            {game.result.blackPlayer.name}
            <span>({game.result.blackPlayer.rating})</span>{' '}
            {game.result.bot === 'black' ? '🤖' : undefined}
          </div>
        </div>
        <button
          onClick={getNewGame}
          className="flex w-full items-center justify-center rounded bg-engine-3 py-2 transition duration-200 hover:bg-engine-4 disabled:bg-background-3"
        >
          <p className="text-lg">Next</p>
        </button>
      </div>
    )

  return (
    <div className="flex flex-col gap-1 border-t border-glassBorder">
      <div className="flex flex-col gap-3 p-3">
        <h2 className="text-2xl font-semibold">Who is the bot?</h2>
        <div className="flex flex-1 flex-row items-center justify-between">
          <button
            className="m-0 flex w-1/3 flex-row justify-start bg-transparent p-0"
            onClick={() => setSelected('white')}
          >
            <p
              className={`${selected === 'white' ? 'font-semibold text-primary' : 'text-secondary'}`}
            >
              White {selected == 'white' && '🤖'}
            </p>
          </button>
          <div
            style={{
              boxShadow: '0px 0px 10px 5px rgba(255,255,255,0.05)',
            }}
            className={`relative flex h-8 w-16 items-center rounded-full p-1 transition duration-300 ${selected === 'white' ? 'bg-white bg-opacity-80' : 'bg-black bg-opacity-60'}`}
          >
            <motion.div
              animate={{
                x: selected === null ? 16 : selected == 'white' ? 0 : 30,
              }}
              style={{
                shadow: '0px 0px 5px 5px rgba(255,255,255,0.75)',
              }}
              transition={{ duration: 0.3 }}
              layout="position"
              className="absolute h-6 w-6 transform rounded-full bg-engine-4 shadow-md"
            />
          </div>
          <button
            className="m-0 flex w-1/3 flex-row justify-end bg-transparent p-0"
            onClick={() => setSelected('black')}
          >
            <p
              className={`${selected === 'black' ? 'font-semibold text-primary' : 'text-secondary'}`}
            >
              {selected == 'black' && '🤖'} Black
            </p>
          </button>
        </div>
      </div>
      <textarea
        className="border-t border-glassBorder bg-transparent p-2 text-sm text-secondary outline-none placeholder:text-secondary"
        placeholder="Optional justification"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button
        onClick={handleSubmit}
        disabled={!selected}
        className="flex w-full items-center justify-center border-t border-glassBorder bg-red-500 py-2 transition duration-200 hover:bg-red-400 disabled:bg-black/40"
      >
        <p className="text-lg">Submit</p>
      </button>
    </div>
  )
}
