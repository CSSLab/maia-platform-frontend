import { useContext, useEffect, useRef } from 'react'
import { AuthContext } from 'src/contexts/AuthContext'
import { Color, PlayGameConfig, Termination } from 'src/types'
import {
  PlayGameProperties,
  PlayGameType,
  PlayResult,
  trackMaiaMoveLatency,
  trackPlayFirstMove,
  trackPlayGameAbandoned,
  trackPlayGameEnded,
  trackPlayGameFirstMoves,
  trackPlayGameStarted,
} from 'src/lib/analytics'
import { MAIA_PLAY_MODEL_VERSION } from 'src/api/play'
import { canResume } from 'src/lib/unfinishedGame'
import { takeOpponentChoice } from 'src/lib/opponentChoice'

// Maia's first replies in a game are all timed; after them, about one in ten.
export const LATENCY_ALWAYS_SENT = 3
export const LATENCY_SAMPLE_RATE = 0.1

const gameType = (config: PlayGameConfig): PlayGameType =>
  config.playType === 'handAndBrain'
    ? config.isBrain
      ? 'brain'
      : 'hand'
    : 'play'

const getResult = (
  termination: Termination,
  player: PlayGameConfig['player'],
): PlayResult => {
  if (termination.winner === 'none') return 'draw'
  return termination.winner === player ? 'human_win' : 'maia_win'
}

/** The side that makes the game's first move. */
const firstMover = (config: PlayGameConfig): Color =>
  config.startFen?.trim().split(/\s+/)[1] === 'b' ? 'black' : 'white'

interface Tracked {
  id: string
  game: PlayGameProperties | null
  // An unlimited or practice game, which this browser can continue later.
  resumable: boolean
  startedAt: number
  // Moves already in the game when it started here (a continued game).
  initialPly: number
  ply: number
  // When the visitor's side last moved, while Maia's reply is awaited.
  waitingSince: number | null
  maiaMoves: number
  firstMoves: boolean
  // Ended or abandoned: nothing more is sent for it.
  closed: boolean
}

const emptyTracked = (): Tracked => ({
  id: '',
  game: null,
  resumable: false,
  startedAt: 0,
  initialPly: 0,
  ply: 0,
  waitingSince: null,
  maiaMoves: 0,
  firstMoves: false,
  closed: false,
})

/**
 * The analytics of one game against Maia (or of Hand & Brain): started,
 * first move, Maia's reply times, and ended or abandoned. `moveCount`: the
 * plies in the game's main line.
 */
export const usePlayGameTracking = (
  id: string,
  config: PlayGameConfig,
  moveCount: number,
  termination: Termination | undefined,
  options: { resumed?: boolean; simulateMaiaTime?: boolean } = {},
) => {
  const { user } = useContext(AuthContext)
  const tracked = useRef<Tracked>(emptyTracked())

  const abandon = (exit: 'new_game' | 'unmount' | 'pagehide') => {
    const t = tracked.current
    if (!t.game || t.closed) return
    t.closed = true
    trackPlayGameAbandoned(
      t.game,
      t.ply,
      Date.now() - t.startedAt,
      exit,
      t.resumable,
    )
  }

  useEffect(() => {
    if (!id || tracked.current.id === id) return
    abandon('new_game')

    const game: PlayGameProperties = {
      game_id: id,
      game_type: gameType(config),
      maia_name: config.maiaVersion,
      maia_version: MAIA_PLAY_MODEL_VERSION,
    }
    tracked.current = {
      ...emptyTracked(),
      id,
      game,
      resumable: canResume(config),
      startedAt: Date.now(),
      initialPly: moveCount,
      ply: moveCount,
      firstMoves: moveCount >= 2,
    }
    const opponent = takeOpponentChoice(config.maiaVersion)
    trackPlayGameStarted(game, {
      time_control: config.timeControl,
      player_color: config.player,
      was_default_opponent: opponent.wasDefault,
      opponent_choice: opponent.choice,
      custom_position: !!config.startFen,
      practice: !!config.practice,
      resumed: !!options.resumed,
      logged_in: !!user?.lichessId,
      ...(config.playType === 'handAndBrain'
        ? { maia_partner_name: config.maiaPartnerVersion }
        : {}),
    })
  }, [id])

  useEffect(() => {
    const t = tracked.current
    if (!t.game || t.id !== id || t.closed) return

    // A takeback (practice games): the replies from here on are new ones.
    if (moveCount < t.ply) {
      t.ply = moveCount
      t.waitingSince = null
      return
    }

    const now = Date.now()
    const starter = firstMover(config)
    for (let ply = t.ply + 1; ply <= moveCount; ply++) {
      const mover: Color =
        ply % 2 === 1 ? starter : starter === 'white' ? 'black' : 'white'
      const byVisitor = mover === config.player

      if (ply === 1 && t.initialPly === 0) {
        trackPlayFirstMove(
          t.game,
          byVisitor ? 'human' : 'maia',
          now - t.startedAt,
        )
      }

      if (byVisitor) {
        t.waitingSince = now
        continue
      }

      // Maia moving first replies to the start of the game.
      const since =
        t.waitingSince ?? (ply === t.initialPly + 1 ? t.startedAt : null)
      t.waitingSince = null
      t.maiaMoves += 1
      if (since === null) continue
      const sampleRate =
        t.maiaMoves <= LATENCY_ALWAYS_SENT ? 1 : LATENCY_SAMPLE_RATE
      if (sampleRate < 1 && Math.random() >= sampleRate) continue
      trackMaiaMoveLatency(
        t.game,
        ply,
        now - since,
        sampleRate,
        !!options.simulateMaiaTime,
      )
    }
    t.ply = moveCount

    if (!t.firstMoves && moveCount >= 2) {
      t.firstMoves = true
      trackPlayGameFirstMoves(t.game)
    }
  }, [id, moveCount])

  useEffect(() => {
    const t = tracked.current
    if (!termination || !t.game || t.id !== id || t.closed) return

    t.closed = true
    trackPlayGameEnded(
      t.game,
      getResult(termination, config.player),
      termination.type ?? 'unknown',
      moveCount,
      Date.now() - t.startedAt,
    )
  }, [id, termination, moveCount])

  // Leaving before the end: the tab closes or goes to another site, or the
  // visitor goes to another page of this one.
  useEffect(() => {
    const onPageHide = () => abandon('pagehide')
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      abandon('unmount')
    }
  }, [])
}
