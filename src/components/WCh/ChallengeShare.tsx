/*
 * Sharing a Maia Challenge: how you did (once you've played it) or just the
 * challenge, as text with a link, ready to paste or post.
 */
import { useEffect, useState } from 'react'

import {
  trackWchChallengeShareOpened,
  trackWchChallengeShared,
} from 'src/lib/analytics'
import type { ChallengeGame, ChallengeTally } from 'src/lib/challengeProgress'

import { SITE, challengePath } from './cards'
import { WCH_CHALLENGES, challengeId } from './challenges'

export const challengeUrl = (round: number) => `${SITE}${challengePath(round)}`

const name = (round: number) => `World Championship Challenge ${round}`

const maiaAt = (g: ChallengeGame) => (g.level ? `Maia ${g.level}` : 'Maia')
const inMoves = (g: ChallengeGame) =>
  g.moves ? ` in ${g.moves} ${g.moves === 1 ? 'move' : 'moves'}` : ''

/** "I passed World Championship Challenge 1: I beat Maia 1500 in 15 moves." */
export const resultText = (round: number, g: ChallengeGame) =>
  g.passed && g.outcome === 'win'
    ? `I passed ${name(round)}: I beat ${maiaAt(g)}${inMoves(g)}. Can you?`
    : g.passed
      ? `I passed ${name(round)}: I held ${maiaAt(g)} to a draw${inMoves(g)}. Can you?`
      : g.outcome === 'draw'
        ? `I drew ${maiaAt(g)} in ${name(round)}. Can you beat it?`
        : `${maiaAt(g)} beat me in ${name(round)}. Can you do better?`

/** What the player sees when a challenge game ends. */
export const ChallengeFeedback: React.FC<{
  round: number
  game: ChallengeGame
  /** Whether a draw was enough. */
  drawPasses: boolean
}> = ({ round, game: g, drawPasses }) => {
  const text = g.passed
    ? g.outcome === 'win'
      ? `You beat ${maiaAt(g)}${inMoves(g)}.`
      : `You held ${maiaAt(g)} to a draw${inMoves(g)}.`
    : g.outcome === 'draw'
      ? `A draw with ${maiaAt(g)}. You need a win to pass.`
      : `${maiaAt(g)} won this one.${drawPasses ? ' A draw is enough to pass.' : ''}`
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${
        g.passed
          ? 'border-[#5fbf8a]/50 bg-[#5fbf8a]/10'
          : 'border-white/15 bg-white/[0.04]'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          g.passed ? 'bg-[#5fbf8a] text-black' : 'bg-white/10 text-white/70'
        }`}
      >
        <span className="material-symbols-outlined !text-[28px] !font-bold">
          {g.passed ? 'check' : 'close'}
        </span>
      </span>
      <div className="flex flex-col">
        <span
          className={`text-base font-semibold ${g.passed ? 'text-[#5fbf8a]' : 'text-white'}`}
        >
          {g.passed
            ? `Game ${round} Challenge passed`
            : `Game ${round} Challenge not passed`}
        </span>
        <span className="text-sm text-white/75">
          {text}
          {g.passed ? '' : ' Try again, or pick another level.'}
        </span>
      </div>
    </div>
  )
}

/** The challenge alone. */
export const challengeText = (round: number) => {
  const c = WCH_CHALLENGES.find((x) => x.round === round)
  return `${name(round)}: ${c?.title ?? ''} Play it against Maia at the level you choose.`
}

/** One mark per try at this challenge, in order: passed, drew, lost. */
export const attempts = (tally: ChallengeTally | undefined) => {
  const marks = (tally?.history ?? '')
    .split('')
    .map((c) => (c === 'p' ? '✅' : c === 'd' ? '🟨' : '🟥'))
    .join('')
  return marks ? `Attempts: ${marks}` : ''
}

type Mode = 'result' | 'challenge'

export const ChallengeShareModal: React.FC<{
  round: number
  /** The game to share, if any: the one just played, or the best. */
  game: ChallengeGame | null
  tallies: Record<string, ChallengeTally>
  /** Where it was opened from (for the stats). */
  from: 'card' | 'after_game'
  onClose: () => void
}> = ({ round, game, tallies, from, onClose }) => {
  useEffect(() => {
    trackWchChallengeShareOpened({ round, from, has_result: !!game })
    // Once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [mode, setMode] = useState<Mode>(game ? 'result' : 'challenge')
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  useEffect(() => setCanShare(typeof navigator.share === 'function'), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const url = challengeUrl(round)
  const message =
    mode === 'result' && game
      ? [resultText(round, game), attempts(tallies[challengeId(round)])]
          .filter(Boolean)
          .join('\n')
      : challengeText(round)
  const full = `${message}\n${url}`

  const tracked = (method: 'copy' | 'native' | 'x' | 'reddit') =>
    trackWchChallengeShared({
      round,
      method,
      shared: mode === 'result' && game ? 'result' : 'challenge',
      passed: mode === 'result' && game ? !!game.passed : null,
    })
  const copy = async () => {
    tracked('copy')
    try {
      await navigator.clipboard.writeText(full)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy this', full)
    }
  }
  const share = () => {
    tracked('native')
    navigator.share({ text: message, url }).catch(() => undefined)
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`border-b-2 pb-2 text-sm font-medium transition ${
        mode === m
          ? 'border-[#fe7f6d] text-white'
          : 'border-transparent text-white/55 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
  const secondary =
    'flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/85 transition hover:border-white/30 hover:text-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${name(round)}`}
        className="relative flex w-full max-w-md flex-col gap-4 rounded-xl border border-white/10 bg-[#1f1a1c] p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">
            Share Game {round} Challenge
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-white/50 transition hover:text-white"
          >
            <span className="material-symbols-outlined !text-[22px]">
              close
            </span>
          </button>
        </div>

        {game ? (
          <div className="flex gap-5 border-b border-white/10">
            {tab('result', 'How I did')}
            {tab('challenge', 'The challenge')}
          </div>
        ) : null}

        <div className="whitespace-pre-wrap rounded-lg bg-white/[0.05] p-3 text-[15px] leading-relaxed text-white/90">
          {message}
          {'\n'}
          <span className="text-[#fe7f6d]">{url}</span>
        </div>

        <button
          type="button"
          onClick={copy}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#fe7f6d] px-4 py-2.5 text-base font-semibold text-black transition hover:brightness-110"
        >
          <span className="material-symbols-outlined !text-[20px]">
            {copied ? 'check' : 'content_copy'}
          </span>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <div className="flex gap-2">
          {canShare ? (
            <button type="button" onClick={share} className={secondary}>
              <span className="material-symbols-outlined !text-[17px]">
                arrow_outward
              </span>
              Share
            </button>
          ) : null}
          <a
            className={secondary}
            target="_blank"
            rel="noreferrer"
            onClick={() => tracked('x')}
            href={`https://twitter.com/intent/tweet?${new URLSearchParams({ text: full }).toString()}`}
          >
            Post on X
          </a>
          <a
            className={secondary}
            target="_blank"
            rel="noreferrer"
            onClick={() => tracked('reddit')}
            href={`https://www.reddit.com/submit?${new URLSearchParams({ url, title: message.split('\n')[0] }).toString()}`}
          >
            Post on Reddit
          </a>
        </div>
      </div>
    </div>
  )
}
