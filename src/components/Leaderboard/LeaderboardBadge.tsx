import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { LeaderboardStatus, GameType } from 'src/types'

interface LeaderboardBadgeProps {
  status: LeaderboardStatus
  loading?: boolean
}

export const LeaderboardBadge: React.FC<LeaderboardBadgeProps> = ({
  status,
  loading = false,
}) => {
  if (!status.isOnLeaderboard || loading) {
    return null
  }

  const getGameTypeIcon = (gameType: GameType): string => {
    switch (gameType) {
      case 'regular':
        return 'sports_esports'
      case 'train':
        return 'school'
      case 'turing':
        return 'psychology'
      case 'hand':
        return 'back_hand'
      case 'brain':
        return 'neurology'
      default:
        return 'star'
    }
  }

  const getPositionColor = (position: number): string => {
    if (position === 1) return 'text-yellow-500'
    if (position === 2) return 'text-gray-400'
    if (position === 3) return 'text-amber-600'
    return 'text-blue-500'
  }

  const getPositionIcon = (position: number): string => {
    if (position === 1) return 'military_tech'
    if (position === 2) return 'workspace_premium'
    if (position === 3) return 'star'
    return 'trophy'
  }

  return (
    <div className="w-full">
      <h3 className="mb-3 text-lg font-semibold">Leaderboard Achievements</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {status.positions.map((position) => (
          <motion.div
            key={position.gameType}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Link
              href="/leaderboard"
              className="border-glass-border block rounded-lg border bg-glass p-4 transition-all hover:border-primary hover:bg-glass-strong"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-secondary">
                    {getGameTypeIcon(position.gameType)}
                  </span>
                  <div>
                    <h4 className="font-semibold">{position.gameName}</h4>
                    <p className="text-sm text-secondary">
                      Rating: {position.elo}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-lg font-bold ${getPositionColor(position.position)}`}
                  >
                    #{position.position}
                  </span>
                  <span
                    className={`material-symbols-outlined text-xl ${getPositionColor(position.position)}`}
                  >
                    {getPositionIcon(position.position)}
                  </span>
                </div>
              </div>
              <div className="mt-2 text-xs text-secondary">
                Top {position.position} of 10 • Click to view leaderboard
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
