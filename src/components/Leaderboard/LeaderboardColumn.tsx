import React from 'react'
import { LeaderboardEntry } from 'src/components'

interface Props {
  id: 'regular' | 'puzzles' | 'turing' | 'hand' | 'brain'
  name: 'Regular' | 'Puzzles' | 'Bot/Not' | 'Hand' | 'Brain'
  ranking: {
    display_name: string
    elo: number
  }[]
}

const getIconForType = (id: Props['id']): string => {
  switch (id) {
    case 'regular':
      return 'chess_knight'
    case 'puzzles':
      return 'toys_and_games'
    case 'turing':
      return 'mystery'
    case 'hand':
      return 'back_hand'
    case 'brain':
      return 'network_intelligence'
    default:
      return 'chess_knight'
  }
}

export const LeaderboardColumn: React.FC<Props> = ({
  id,
  name,
  ranking,
}: Props) => {
  return (
    <div className="from-white/8 to-white/4 relative flex flex-col rounded-md border border-glass-border bg-gradient-to-br backdrop-blur-md">
      <div className="flex h-12 flex-row items-center justify-start gap-2 border-b border-glass-border bg-white/5 px-3">
        <span className="material-symbols-outlined material-symbols-filled text-2xl text-white/70">
          {getIconForType(id)}
        </span>
        <h2 className="text-base font-bold uppercase text-white/95">{name}</h2>
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
