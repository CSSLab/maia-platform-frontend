import React, { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { LeaderboardStatus } from 'src/types'

interface ProfileLeaderboardBadgesProps {
  status: LeaderboardStatus
  loading?: boolean
}

export const ProfileLeaderboardBadges: React.FC<
  ProfileLeaderboardBadgesProps
> = ({ status, loading = false }) => {
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null)

  if (!status.isOnLeaderboard || loading) {
    return null
  }

  const handleMouseEnter = (gameType: string) => setHoveredBadge(gameType)
  const handleMouseLeave = () => setHoveredBadge(null)

  return (
    <div className="flex items-center">
      {status.positions.map((position) => (
        <div
          key={position.gameType}
          className="relative"
          onMouseEnter={() => handleMouseEnter(position.gameType)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex cursor-pointer items-center justify-center">
            <span className="material-symbols-outlined material-symbols-filled !text-2xl text-yellow-500">
              workspace_premium
            </span>
          </div>
          <AnimatePresence>
            {hoveredBadge === position.gameType && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute left-1/2 top-full z-50 w-56 -translate-x-1/2 overflow-hidden rounded border border-glass-border bg-backdrop shadow-lg"
              >
                <div className="border-b border-glass-border px-3 py-2">
                  <h3 className="text-sm font-medium text-primary">
                    {position.gameName} Leaderboard Player
                  </h3>
                </div>
                <div className="flex items-center justify-between px-3 py-1">
                  <div className="flex flex-col">
                    <span className="text-sm text-secondary">
                      Rating: {position.elo}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {position.position <= 3 && (
                      <span className="material-symbols-outlined material-symbols-filled !text-lg text-yellow-500">
                        workspace_premium
                      </span>
                    )}
                    <span className="text-sm font-semibold text-yellow-500">
                      #{position.position}
                    </span>
                  </div>
                </div>
                <div className="flex items-center border-t border-background-3 px-3 py-2">
                  <Link
                    href="/leaderboard"
                    className="text-xxs text-secondary hover:text-primary"
                  >
                    View full leaderboard →
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}
