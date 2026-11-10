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
        lastPlayed={stats.regularLastPlayed}
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
        icon="back_hand"
        name="Hand"
        lastPlayed={stats.handLastPlayed}
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
        lastPlayed={stats.brainLastPlayed}
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
        name="Puzzles"
        lastPlayed={stats.trainLastPlayed}
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
        lastPlayed={stats.botNotLastPlayed}
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
