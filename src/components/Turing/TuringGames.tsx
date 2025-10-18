/* eslint-disable jsx-a11y/no-static-element-interactions */
import { useContext } from 'react'
import { TuringControllerContext } from 'src/contexts'

export const TuringGames: React.FC = () => {
  const { gameIds, setCurrentIndex, games } = useContext(
    TuringControllerContext,
  )
  return (
    <div className="flex flex-row flex-wrap items-start justify-start gap-1 overflow-y-auto">
      {gameIds.map((id, index) => {
        const game = games[index]
        return (
          <button
            key={id}
            onClick={() => setCurrentIndex(index)}
            className={`${!game.result ? 'bg-glass' : game.result?.correct ? 'bg-engine-4' : 'bg-human-4'} h-10 w-10 cursor-pointer rounded-sm`}
          >
            {game.result?.ratingDiff ? (
              <>
                <i
                  className={`material-symbols-outlined -mt-1 ${game.result.ratingDiff >= 0 ? 'text-blue-200' : 'text-red-300'}`}
                >
                  {game.result.ratingDiff >= 0
                    ? 'arrow_drop_up'
                    : 'arrow_drop_down'}
                </i>
                <p
                  className={`-mt-2 text-xs tracking-widest ${game.result.ratingDiff >= 0 ? 'text-blue-200' : 'text-red-300'}`}
                >
                  {game.result.ratingDiff >= 0 && '+'}
                  {game.result.ratingDiff}
                </p>
              </>
            ) : (
              <></>
            )}
          </button>
        )
      })}
    </div>
  )
}
