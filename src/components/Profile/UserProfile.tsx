import React from 'react'

import { ProfileColumn } from 'src/components'
import { leaderboardEligibility } from 'src/lib/ratingUtils'
import {
  GameType,
  LeaderboardStatus,
  PlayerStats,
  RatedMode,
  RatingCertainty,
} from 'src/types'

interface Props {
  stats: PlayerStats
  // The player's places on the leaderboards, and the days within which each
  // board's players last played. Both come with the leaderboard.
  leaderboardStatus?: LeaderboardStatus
  windowDays?: Partial<Record<RatedMode, number>>
  /** Whether the profile is the reader's own. */
  own?: boolean
}

export const UserProfile = ({
  stats,
  leaderboardStatus,
  windowDays,
  own,
}: Props) => {
  const ratingDetails = (
    certainty: RatingCertainty,
    gameType: GameType,
    mode: RatedMode,
  ) => ({
    own,
    certainty,
    windowDays: windowDays?.[mode],
    eligibility: leaderboardEligibility({
      certainty,
      position: leaderboardStatus?.positions.find(
        (position) => position.gameType === gameType,
      )?.position,
      windowDays: windowDays?.[mode],
    }),
  })

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
        {...ratingDetails(stats.regularCertainty, 'regular', 'play')}
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
        {...ratingDetails(stats.handCertainty, 'hand', 'hand')}
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
        {...ratingDetails(stats.brainCertainty, 'brain', 'brain')}
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
        unit="puzzles"
        {...ratingDetails(stats.trainCertainty, 'train', 'puzzles')}
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
        {...ratingDetails(stats.botNotCertainty, 'turing', 'turing')}
      />
    </div>
  )
}
