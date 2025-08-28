import React from 'react'

import { ProfileColumn } from 'src/components'
import { PlayerStats } from 'src/types'

interface Props {
  stats: PlayerStats
}

export const UserProfile = ({ stats }: Props) => {
  return (
    <div className="grid h-full w-full grid-cols-1 gap-2 md:gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      <ProfileColumn
        icon="chess_knight"
        name="Regular"
        data={{
          rating: stats.regularRating,
          highest: stats.regularMax,
          hours: stats.regularHours,
          games: stats.regularGames,
          wins: stats.regularWins,
          draws: stats.regularDraws,
        }}
      />
      <ProfileColumn
        icon="network_intel_node"
        name="Hand"
        data={{
          rating: stats.handRating,
          highest: stats.handMax,
          hours: stats.handHours,
          games: stats.handGames,
          wins: stats.handWins,
          draws: stats.handDraws,
        }}
      />
      <ProfileColumn
        icon="network_intelligence"
        name="Brain"
        data={{
          rating: stats.brainRating,
          highest: stats.brainMax,
          hours: stats.brainHours,
          games: stats.brainGames,
          wins: stats.brainWins,
          draws: stats.brainDraws,
        }}
      />
      <ProfileColumn
        icon="toys_and_games"
        name="Train"
        data={{
          rating: stats.trainRating,
          highest: stats.trainMax,
          hours: stats.trainHours,
          games: stats.trainGames,
          wins: stats.trainCorrect,
        }}
      />
      <ProfileColumn
        icon="mystery"
        name="Bot / Not"
        data={{
          rating: stats.botNotRating,
          highest: stats.botNotMax,
          hours: stats.botNotHours,
          games: stats.botNotCorrect + stats.botNotWrong,
          wins: stats.botNotCorrect,
          losses: stats.botNotWrong,
        }}
      />
    </div>
  )
}
