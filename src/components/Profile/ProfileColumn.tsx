import React from 'react'

interface Props {
  icon: string
  name: string
  data: {
    rating: number
    highest: number
    hours: number
    games: number
    wins: number
    draws?: number
    losses?: number
  }
}

export const ProfileColumn: React.FC<Props> = ({ icon, name, data }: Props) => {
  const wins = data.wins
  const draws = data.draws ?? 0
  const losses = data.losses ?? data.games - data.wins - (data?.draws || 0)

  return (
    <div className="flex w-full flex-col gap-3 overflow-hidden rounded-md border border-glass-border bg-glass">
      <div className="flex flex-row items-center justify-start gap-2 px-4 pt-3">
        <span className="material-symbols-outlined material-symbols-filled text-xl text-primary/80 md:!text-3xl">
          {icon}
        </span>
        <p className="text-xl font-bold text-white/95 md:text-2xl">{name}</p>
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center justify-center gap-1">
            <p className="text-sm text-white/70 xl:text-base">Rating</p>
            <b className="text-xl text-white/95 xl:text-2xl">{data.rating}</b>
          </div>
          <div className="flex flex-col items-center justify-center gap-1">
            <p className="text-sm text-white/70 xl:text-base">Highest</p>
            <b className="text-xl text-white/95 xl:text-2xl">{data.highest}</b>
          </div>
          <div className="flex flex-col items-center justify-center gap-1">
            <p className="text-sm text-white/70 xl:text-base">Games</p>
            <b className="text-xl text-white/95 xl:text-2xl">{data.games}</b>
          </div>
          {/* <div className="flex flex-col items-center justify-center gap-1">
            <p className="text-sm xl:text-base">Hours</p>
            <b className="text-xl xl:text-2xl">{data.hours}</b>
          </div> */}
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded border border-white/20 bg-green-500/80" />
              <p className="text-xs text-white/80">
                Wins: {wins}{' '}
                <span className="text-white/60">
                  ({Math.round((wins * 100) / data.games) || 0}%)
                </span>
              </p>
            </div>
            {draws > 0 ? (
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded border border-white/20 bg-yellow-500/80" />
                <p className="text-xs text-white/80">
                  Draws: {draws}{' '}
                  <span className="text-white/60">
                    ({Math.round((draws * 100) / data.games) || 0}%)
                  </span>
                </p>
              </div>
            ) : (
              <></>
            )}
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded border border-white/20 bg-red-500/80" />
              <p className="text-xs text-white/80">
                Losses: {losses}{' '}
                <span className="text-white/60">
                  ({Math.round((losses * 100) / data.games) || 0}%)
                </span>
              </p>
            </div>
          </div>
          <div className="flex h-6 w-full overflow-hidden rounded border border-white/20">
            {wins > 0 && (
              <div
                className="h-full border-r border-white/20 bg-green-500/80"
                style={{ width: `${(wins / data.games) * 100}%` }}
              />
            )}

            {draws > 0 && (
              <div
                className="h-full border-r border-white/20 bg-yellow-500/80"
                style={{ width: `${(draws / data.games) * 100}%` }}
              />
            )}
            {losses > 0 && (
              <div
                className="h-full bg-red-500/80"
                style={{ width: `${(losses / data.games) * 100}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
