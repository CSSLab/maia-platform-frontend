import React from 'react'

import {
  Rating,
  RatedUnit,
  Tooltip,
  rankAdvice,
} from 'src/components/Common/Rating'
import { TimeAgo } from 'src/components/Common/TimeAgo'
import { LeaderboardEligibility } from 'src/lib/ratingUtils'
import { RatingCertainty } from 'src/types'

// The leaderboard row's value, and a line saying why. `own`: the reader is
// the player.
const describeEligibility = (
  eligibility: LeaderboardEligibility,
  { windowDays, own, unit }: Pick<Props, 'windowDays' | 'own' | 'unit'>,
): { value: string; note?: string } => {
  switch (eligibility.state) {
    case 'listed':
      return { value: `#${eligibility.position}` }
    case 'eligible':
      return {
        value: 'Eligible',
        note: own
          ? 'You\u2019re not in the top 10 right now.'
          : 'Not in the top 10 right now.',
      }
    case 'provisional':
      return {
        value: 'Not eligible',
        note: own
          ? rankAdvice(unit)
          : 'Provisional ratings aren\u2019t ranked.',
      }
    case 'inactive':
      return {
        value: 'Not eligible',
        note: `${own ? 'You haven\u2019t' : 'Hasn\u2019t'} played in the last ${windowDays} days.`,
      }
    case 'settled':
      return {
        value: 'Eligible',
        note:
          windowDays === undefined
            ? 'Only recently active players are ranked.'
            : `Only players active in the last ${windowDays} days are ranked.`,
      }
  }
}

const DEVIATION_HINT =
  'How uncertain the rating is. It drops with every result and creeps up during time away. Above 110, the rating is provisional.'
const VOLATILITY_HINT =
  'How much results swing. Steady results keep it low; surprising wins and losses raise it.'

const DetailRow = ({
  label,
  hint,
  children,
}: {
  label: string
  // Shown in a tooltip on the label.
  hint?: string
  children: React.ReactNode
}) => (
  <div className="flex items-baseline justify-between gap-3">
    {hint ? (
      <Tooltip
        text={hint}
        label={`${label}: ${hint}`}
        className="text-white/60 underline decoration-white/30 decoration-dotted underline-offset-2"
      >
        {label}
      </Tooltip>
    ) : (
      <span className="text-white/60">{label}</span>
    )}
    <span className="text-right font-medium text-white/90">{children}</span>
  </div>
)

interface Props {
  icon: string
  name: string
  /** When the player's last rated result in this mode was, if known. */
  lastPlayed?: number | null
  data: {
    rating: number
    highest: number
    hours: number
    games: number
    wins: number
    draws?: number
    losses?: number
  }
  // How certain the rating is, and where it stands for the mode's leaderboard.
  certainty?: RatingCertainty
  eligibility?: LeaderboardEligibility
  // Days within which the leaderboard's players last played.
  windowDays?: number
  /** Whether the reader is the player: the notes then speak to them. */
  own?: boolean
  /** What a rated result in this mode is; games unless given. */
  unit?: RatedUnit
}

export const ProfileColumn: React.FC<Props> = ({
  icon,
  name,
  lastPlayed,
  data,
  certainty,
  eligibility,
  windowDays,
  own,
  unit = 'games',
}: Props) => {
  const wins = data.wins
  const draws = data.draws ?? 0
  const losses = data.losses ?? data.games - data.wins - (data?.draws || 0)
  const leaderboard = eligibility
    ? describeEligibility(eligibility, { windowDays, own, unit })
    : undefined

  return (
    <div className="flex w-full flex-col gap-3 overflow-hidden rounded-md border border-glass-border bg-glass">
      <div className="flex flex-row items-center justify-start gap-2 px-4 pt-3">
        <span className="material-symbols-outlined material-symbols-filled text-xl text-primary/80 md:!text-3xl">
          {icon}
        </span>
        <p className="text-xl font-bold text-white/95 md:text-2xl">{name}</p>
        <TimeAgo
          time={lastPlayed}
          prefix="Last played "
          className="ml-auto whitespace-nowrap text-xs text-white/50"
        />
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center justify-center gap-1">
            <p className="text-sm text-white/70 xl:text-base">Rating</p>
            <b className="text-xl text-white/95 xl:text-2xl">
              <Rating
                rating={data.rating}
                provisional={certainty?.provisional}
                own={own}
                unit={unit}
              />
            </b>
          </div>
          <div className="flex flex-col items-center justify-center gap-1">
            <p className="text-sm text-white/70 xl:text-base">Highest</p>
            <b className="text-xl text-white/95 xl:text-2xl">{data.highest}</b>
          </div>
          <div className="flex flex-col items-center justify-center gap-1">
            <p className="text-sm text-white/70 xl:text-base">Games</p>
            <b className="text-xl text-white/95 xl:text-2xl">{data.games}</b>
          </div>
          {/* <div className="flex flex-col items-center justify-center gap-1">
            <p className="text-sm xl:text-base">Hours</p>
            <b className="text-xl xl:text-2xl">{data.hours}</b>
          </div> */}
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded border border-white/20 bg-green-500/80" />
              <p className="text-xs text-white/80">
                Wins: {wins}{' '}
                <span className="text-white/60">
                  ({Math.round((wins * 100) / data.games) || 0}%)
                </span>
              </p>
            </div>
            {draws > 0 ? (
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded border border-white/20 bg-yellow-500/80" />
                <p className="text-xs text-white/80">
                  Draws: {draws}{' '}
                  <span className="text-white/60">
                    ({Math.round((draws * 100) / data.games) || 0}%)
                  </span>
                </p>
              </div>
            ) : (
              <></>
            )}
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded border border-white/20 bg-red-500/80" />
              <p className="text-xs text-white/80">
                Losses: {losses}{' '}
                <span className="text-white/60">
                  ({Math.round((losses * 100) / data.games) || 0}%)
                </span>
              </p>
            </div>
          </div>
          <div className="flex h-6 w-full overflow-hidden rounded border border-white/20">
            {wins > 0 && (
              <div
                className="h-full border-r border-white/20 bg-green-500/80"
                style={{ width: `${(wins / data.games) * 100}%` }}
              />
            )}

            {draws > 0 && (
              <div
                className="h-full border-r border-white/20 bg-yellow-500/80"
                style={{ width: `${(draws / data.games) * 100}%` }}
              />
            )}
            {losses > 0 && (
              <div
                className="h-full bg-red-500/80"
                style={{ width: `${(losses / data.games) * 100}%` }}
              />
            )}
          </div>
        </div>
        {certainty && (
          <div className="flex flex-col gap-1 border-t border-glass-border pt-3 text-xs">
            <DetailRow label="Rating status">
              <span
                className={
                  certainty.provisional ? 'text-yellow-500' : 'text-green-500'
                }
              >
                {certainty.provisional ? 'Provisional' : 'Established'}
              </span>
            </DetailRow>
            {certainty.deviation !== undefined && (
              <DetailRow label="Deviation" hint={DEVIATION_HINT}>
                {Math.round(certainty.deviation)}
              </DetailRow>
            )}
            {certainty.volatility !== undefined && (
              <DetailRow label="Volatility" hint={VOLATILITY_HINT}>
                {certainty.volatility.toFixed(3)}
              </DetailRow>
            )}
            {leaderboard && (
              <>
                <DetailRow label="Leaderboard">{leaderboard.value}</DetailRow>
                {leaderboard.note && (
                  <p className="text-white/50">{leaderboard.note}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
