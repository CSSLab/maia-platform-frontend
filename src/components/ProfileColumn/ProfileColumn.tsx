interface Props {
  icon: JSX.Element
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
    <div className="flex w-full flex-col md:w-[500px]">
      <div className="flex flex-row items-center justify-start gap-4 bg-background-2 px-6 py-5 md:px-8">
        <div className="h-[28px] w-[28px] md:h-[38px] md:w-[38px]">{icon}</div>
        <p className="text-2xl font-bold md:text-3xl">{name}</p>
      </div>
      <div className="flex flex-col gap-6 bg-background-1 px-6 py-5 md:px-8">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center justify-center gap-1 text-human-1">
            <p>Rating</p>
            <b className="text-4xl">{data.rating}</b>
          </div>
          <div className="flex flex-col items-center justify-center gap-1">
            <p>Highest</p>
            <b className="text-4xl">{data.highest}</b>
          </div>
          <div className="flex flex-col items-center justify-center gap-1">
            <p>Games</p>
            <b className="text-4xl">{data.games}</b>
          </div>
          <div className="flex flex-col items-center justify-center gap-1">
            <p>Hours</p>
            <b className="text-4xl">{data.hours}</b>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-1">
              <div className="h-4 w-4 border border-black bg-green-500" />
              <p className="text-sm">
                Wins: {wins}{' '}
                <span className="text-secondary">
                  ({Math.round((wins * 100) / data.games) || 0}%)
                </span>
              </p>
            </div>
            {draws > 0 ? (
              <div className="flex items-center gap-1">
                <div className="h-4 w-4 border border-black bg-blue-500" />
                <p className="text-sm">
                  Draws: {draws}{' '}
                  <span className="text-secondary">
                    ({Math.round((draws * 100) / data.games) || 0}%)
                  </span>
                </p>
              </div>
            ) : (
              <></>
            )}
            <div className="flex items-center gap-1">
              <div className="h-4 w-4 border border-black bg-red-500" />
              <p className="text-sm">
                Losses: {losses}{' '}
                <span className="text-secondary">
                  ({Math.round((losses * 100) / data.games) || 0}%)
                </span>
              </p>
            </div>
          </div>
          <div className="flex h-10 w-full border-2 border-black">
            {wins > 0 && (
              <div
                className="h-full bg-green-500"
                style={{ width: `${(wins / data.games) * 100}%` }}
              />
            )}
            {draws > 0 && (
              <div
                className="h-full bg-blue-500"
                style={{ width: `${(draws / data.games) * 100}%` }}
              />
            )}
            {losses > 0 && (
              <div
                className="h-full bg-red-500"
                style={{ width: `${(losses / data.games) * 100}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
