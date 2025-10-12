import React, { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { LeaderboardStatus } from 'src/types'

interface LeaderboardNavBadgeProps {
  status: LeaderboardStatus
  loading?: boolean
}

export const LeaderboardNavBadge: React.FC<LeaderboardNavBadgeProps> = ({
  status,
  loading = false,
}) => {
  const [showDropdown, setShowDropdown] = useState(false)

  if (!status.isOnLeaderboard || loading) {
    return null
  }

  const handleMouseEnter = () => setShowDropdown(true)
  const handleMouseLeave = () => setShowDropdown(false)

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trophy Badge */}
      <div className="flex cursor-pointer items-center justify-center">
        <div className="relative">
          <span className="material-symbols-outlined material-symbols-filled !text-2xl text-yellow-500">
            trophy
          </span>
          {status.totalLeaderboards > 0 && (
            <span className="absolute right-0 top-0 flex h-3 w-3 items-center justify-center rounded-full bg-green-500 text-[8px] font-semibold text-white">
              {status.totalLeaderboards}
            </span>
          )}
        </div>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full z-50 w-64 overflow-hidden rounded-md border border-glass-border text-white/90 shadow-lg"
            style={{
              background:
                'radial-gradient(ellipse 110% 90% at 20% 10%, rgba(239, 68, 68, 0.10) 0%, rgba(239, 68, 68, 0.06) 35%, transparent 75%), #171214',
            }}
          >
            <div className="border-b border-glass-border px-3 py-2">
              <h3 className="text-sm font-medium text-white/90">
                You&apos;re on the leaderboard!
              </h3>
            </div>
            <div className="flex flex-col">
              {status.positions.map((position) => (
                <Link
                  key={position.gameType}
                  href="/leaderboard"
                  className="flex items-center justify-between px-3 py-2 text-white/90 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white/90">
                      {position.gameName}
                    </span>
                    <span className="text-xs text-secondary">
                      Rating: {position.elo}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {position.position <= 3 && (
                      <span className="material-symbols-outlined !text-lg text-yellow-500">
                        workspace_premium
                      </span>
                    )}
                    <span className="text-base font-semibold text-yellow-500">
                      #{position.position}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="border-t border-glass-border px-3 py-2">
              <Link
                href="/leaderboard"
                className="text-xs text-secondary hover:text-primary"
              >
                View full leaderboard →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
