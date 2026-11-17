import React from 'react'

import {
  PlayedLikeContribution,
  PlayedLikeEstimate,
  describeContribution,
} from 'src/lib/playedLike'

interface Props {
  estimate: PlayedLikeEstimate | null
  color: 'white' | 'black'
  playerName: string
  /** The player's own rating, marked on the range for comparison. */
  playerRating?: number | null
  /** How many moves to list in each direction. */
  movesShown?: number
  onSelectPly?: (ply: number) => void
}

const SCALE_LO = 600
const SCALE_HI = 2800
const pct = (r: number) =>
  `${(100 * (Math.min(SCALE_HI, Math.max(SCALE_LO, r)) - SCALE_LO)) / (SCALE_HI - SCALE_LO)}%`

/** Moves that moved the estimate by less than this aren't listed. */
const MIN_SHIFT = 10

const headline = (e: PlayedLikeEstimate): string => {
  if (e.atCeiling) return `${Math.round(e.lo80 / 100) * 100}+`
  if (e.atFloor) return `under ${Math.round(e.hi80 / 100) * 100}`
  return `~${e.rounded}`
}

const MoveRow: React.FC<{
  c: PlayedLikeContribution
  color: 'white' | 'black'
  onSelectPly?: (ply: number) => void
}> = ({ c, color, onSelectPly }) => (
  <li className="flex items-baseline justify-between gap-2 text-xs">
    <button
      type="button"
      onClick={() => onSelectPly?.(c.ply)}
      className="min-w-0 text-left text-white/80 underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
    >
      {describeContribution(c, color)}
    </button>
    <span
      className={`shrink-0 tabular-nums ${c.shift >= 0 ? 'text-human-2' : 'text-white/50'}`}
      title="How far this move moved the estimate"
    >
      {c.shift >= 0 ? '+' : '−'}
      {Math.abs(Math.round(c.shift))}
    </span>
  </li>
)

/**
 * "Played like ~X" for one player: the estimate, its 80% range against the
 * player's own rating, and the moves that moved it most each way.
 */
export const PlayedLike: React.FC<Props> = ({
  estimate,
  color,
  playerName,
  playerRating,
  movesShown = 3,
  onSelectPly,
}) => {
  if (!estimate) {
    return (
      <div className="rounded border border-glass-border bg-glass px-3 py-2 text-xs text-white/60">
        Not enough moves to say how {playerName} played.
      </div>
    )
  }
  const up = estimate.contributions
    .filter((c) => c.shift >= MIN_SHIFT)
    .slice(0, movesShown)
  const down = estimate.contributions
    .filter((c) => c.shift <= -MIN_SHIFT)
    .slice(0, movesShown)

  return (
    <div className="flex flex-col gap-2 rounded border border-glass-border bg-glass px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-human-2">
          {playerName} played like
        </span>
        {estimate.lowConfidence && (
          <span
            className="text-[10px] text-white/50"
            title="Few moves or mixed signals: the range is wide"
          >
            rough estimate
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums leading-none text-white">
          {headline(estimate)}
        </span>
        <span className="text-xs tabular-nums text-white/60">
          likely {Math.round(estimate.lo80 / 50) * 50}–
          {Math.round(estimate.hi80 / 50) * 50}
        </span>
      </div>
      <div
        className="relative h-2 w-full rounded-full bg-white/10"
        role="img"
        aria-label={`Estimate ${estimate.rounded}, 80% range ${Math.round(estimate.lo80)} to ${Math.round(estimate.hi80)}${playerRating ? `, rated ${playerRating}` : ''}`}
      >
        <div
          className="absolute top-0 h-2 rounded-full bg-human-3/70"
          style={{
            left: pct(estimate.lo80),
            width: `calc(${pct(estimate.hi80)} - ${pct(estimate.lo80)})`,
          }}
        />
        <div
          className="absolute -top-0.5 h-3 w-0.5 bg-white"
          style={{ left: pct(estimate.mean) }}
        />
        {playerRating ? (
          <div
            className="absolute -top-1 h-4 w-px bg-white/50"
            style={{ left: pct(playerRating) }}
            title={`Rated ${playerRating}`}
          />
        ) : null}
      </div>
      {playerRating ? (
        <p className="text-[10.5px] text-white/60">
          Rated {playerRating}.{' '}
          {playerRating < estimate.lo80
            ? 'This game looked stronger than that.'
            : playerRating > estimate.hi80
              ? 'This game looked weaker than that.'
              : 'This game fits that rating.'}
        </p>
      ) : null}
      {up.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/55">
            Moves that raised it
          </span>
          <ul className="flex flex-col gap-0.5">
            {up.map((c) => (
              <MoveRow
                key={c.ply}
                c={c}
                color={color}
                onSelectPly={onSelectPly}
              />
            ))}
          </ul>
        </div>
      )}
      {down.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/55">
            Moves that lowered it
          </span>
          <ul className="flex flex-col gap-0.5">
            {down.map((c) => (
              <MoveRow
                key={c.ply}
                c={c}
                color={color}
                onSelectPly={onSelectPly}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
