import { LeaderboardEntry } from 'src/components'

interface Props {
  id: 'regular' | 'train' | 'turing' | 'hand' | 'brain'
  name: 'Regular' | 'Train' | 'Bot/Not' | 'Hand' | 'Brain'
  icon: JSX.Element
  ranking: {
    display_name: string
    elo: number
  }[]
}

export const LeaderboardColumn: React.FC<Props> = ({
  id,
  icon,
  name,
  ranking,
}: Props) => {
  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-center justify-start gap-3 bg-background-2 px-6 py-4">
        <i className="*:h-6 *:w-6">{icon}</i>
        <h2 className="text-2xl font-bold uppercase">{name}</h2>
      </div>
      <div className="flex w-full flex-col">
        {ranking.map((player, index) => (
          <LeaderboardEntry
            key={index}
            typeId={id}
            type={name}
            index={index}
            {...player}
          />
        ))}
      </div>
    </div>
  )
}
