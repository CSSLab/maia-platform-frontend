import { useState, useEffect, useContext } from 'react'

import { Color } from 'src/types'
import { AuthContext } from 'src/contexts'
import { PlayControllerContext } from 'src/contexts/PlayControllerContext'
import { MaterialBalance } from 'src/components/Common/MaterialBalance'

interface Props {
  player: Color
  reversed: boolean
}

export const GameClock: React.FC<Props> = (
  props: React.PropsWithChildren<Props>,
) => {
  const { user } = useContext(AuthContext)
  const {
    player,
    toPlay,
    whiteClock,
    blackClock,
    lastMoveTime,
    maiaVersion,
    currentNode,
  } = useContext(PlayControllerContext)

  const [referenceTime, setReferenceTime] = useState<number>(Date.now())

  const playerClock = props.player === 'white' ? whiteClock : blackClock
  const active = toPlay === props.player

  const clock = Math.max(
    active && lastMoveTime > 0
      ? playerClock - referenceTime + lastMoveTime
      : playerClock,
    0,
  )

  // Convert maiaVersion (e.g., "maia_kdd_1100") to display name (e.g., "Maia 1100")
  const getMaiaDisplayName = (version: string): string => {
    return version.replace('maia_kdd_', 'Maia ')
  }

  useEffect(() => {
    setReferenceTime(Date.now())

    if (active) {
      const interval = setInterval(() => setReferenceTime(Date.now()), 50)
      return () => clearInterval(interval)
    }

    return () => undefined
  }, [active, setReferenceTime])

  const minutes = Math.floor(clock / 60000)
  const seconds = Math.floor(clock / 1000) - minutes * 60
  const tenths = Math.floor(clock / 100) - seconds * 10 - minutes * 600

  const showTenths = minutes < 1 && seconds <= 20

  return (
    <div
      className="flex flex-row items-center justify-between bg-glass-strong md:flex-col md:items-start md:justify-start"
    >
      <div className="flex w-full items-center justify-between gap-3 px-4 py-2">
        <span
          className={`flex items-center gap-2 transition-colors ${
            active ? 'text-white' : 'text-white/55'
          }`}
        >
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              props.player === 'white'
                ? 'bg-white ring-1 ring-white/70'
                : 'bg-black ring-1 ring-white/35'
            } ${active ? 'animate-pulse ring-2 ring-primary/35' : ''}`}
          />
          <span>
            {player === props.player
              ? user?.displayName
              : getMaiaDisplayName(maiaVersion)}
          </span>
        </span>
        <MaterialBalance
          fen={currentNode?.fen}
          color={props.player}
          className="gap-2"
          iconClassName="!text-xl md:!text-2xl text-white/95"
          textClassName="text-base md:text-lg text-white/90"
          pieceFilter={
            props.player === 'black'
              ? 'brightness(1.18) contrast(1.08)'
              : undefined
          }
        />
      </div>
      <div
        className={`inline-flex self-start px-4 py-2 transition-all duration-200 md:text-3xl ${
          active
            ? 'font-semibold text-primary'
            : 'text-white/55'
        }`}
      >
        {minutes}:{('00' + seconds).slice(-2)}
        {showTenths ? '.' + tenths : null}
      </div>
    </div>
  )
}
