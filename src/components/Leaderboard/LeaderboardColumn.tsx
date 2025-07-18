import React from 'react'
import { LeaderboardEntry } from 'src/components'

interface Props {
  id: 'regular' | 'train' | 'turing' | 'hand' | 'brain'
  name: 'Regular' | 'Train' | 'Bot/Not' | 'Hand' | 'Brain'
  icon: React.JSX.Element
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
    <div className="flex flex-col rounded border border-white/10 bg-background-1/60">
      <div className="flex flex-row items-center justify-start gap-2 rounded-t bg-background-2 px-4 py-2">
        <i className="*:h-5 *:w-5">{icon}</i>
        <h2 className="text-xl font-bold uppercase">{name}</h2>
      </div>
      <div className="flex w-full flex-col rounded-b">
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
