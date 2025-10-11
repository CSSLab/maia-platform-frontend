import Image from 'next/image'
import { Chess } from 'chess.ts'
import toast from 'react-hot-toast'
import { useRouter } from 'next/router'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useContext, useState } from 'react'

import {
  Color,
  PlayType,
  TimeControl,
  TimeControlOptionNames,
  TimeControlOptions,
} from 'src/types'
import { ModalContext } from 'src/contexts'
import { ModalContainer } from './ModalContainer'

const maiaOptions = [
  'maia_kdd_1100',
  'maia_kdd_1200',
  'maia_kdd_1300',
  'maia_kdd_1400',
  'maia_kdd_1500',
  'maia_kdd_1600',
  'maia_kdd_1700',
  'maia_kdd_1800',
  'maia_kdd_1900',
]

interface OptionSelectProps<T> {
  options: T[]
  labels: string[]
  selected: T
  onChange: (selected: T) => void
}

function OptionSelect<T>({
  options,
  labels,
  selected,
  onChange,
}: OptionSelectProps<T>) {
  return (
    <div className="flex overflow-hidden rounded-lg">
      {options.map((option, index) => {
        return (
          <button
            key={index}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              option === selected
                ? 'border-glass-border border bg-glass-stronger text-white'
                : 'border-glass-border border bg-glass text-white/90 hover:bg-glass-stronger'
            } ${index === 0 ? 'rounded-l-lg' : ''} ${
              index === options.length - 1 ? 'rounded-r-lg' : ''
            }`}
            onClick={() => onChange(option)}
          >
            {labels[index]}
          </button>
        )
      })}
    </div>
  )
}

interface Props {
  playType: PlayType
  player?: Color
  timeControl?: TimeControl
  maiaPartnerVersion?: string
  maiaVersion?: string
  isBrain?: boolean
  sampleMoves?: boolean
  simulateMaiaTime?: boolean
  startFen?: string
}

export const PlaySetupModal: React.FC<Props> = (props: Props) => {
  const { setPlaySetupModalProps } = useContext(ModalContext)
  const { push } = useRouter()

  const [timeControl, setTimeControl] = useState<TimeControl>(
    props.timeControl || TimeControlOptions[0],
  )
  const [timeMinutes, setTimeMinutes] = useState<number>(() => {
    const initial = props.timeControl || TimeControlOptions[0]
    if (initial === 'unlimited') return 0
    return parseInt(initial.split('+')[0])
  })
  const [incrementSeconds, setIncrementSeconds] = useState<number>(() => {
    const initial = props.timeControl || TimeControlOptions[0]
    if (initial === 'unlimited') return 0
    return parseInt(initial.split('+')[1])
  })
  const [isBrain, setIsBrain] = useState<boolean>(props.isBrain || false)
  const [sampleMoves, setSampleMoves] = useState<boolean>(
    props.sampleMoves || true,
  )
  const [simulateMaiaTime, setSimulateMaiaTime] = useState<boolean>(
    props.simulateMaiaTime !== undefined ? props.simulateMaiaTime : true,
  )

  const [maiaPartnerVersion, setMaiaPartnerVersion] = useState<string>(
    props.maiaPartnerVersion || maiaOptions[0],
  )
  const [maiaVersion, setMaiaVersion] = useState<string>(
    props.maiaVersion || maiaOptions[0],
  )
  const [fen, setFen] = useState<string | undefined>(
    props.startFen ? props.startFen : undefined,
  )

  const [openMoreOptions, setMoreOptionsOpen] = useState<boolean>(true)

  const handlePresetSelect = useCallback((preset: TimeControl) => {
    setTimeControl(preset)
    if (preset === 'unlimited') {
      setTimeMinutes(0)
      setIncrementSeconds(0)
    } else {
      const [minutes, increment] = preset.split('+').map(Number)
      setTimeMinutes(minutes)
      setIncrementSeconds(increment)
    }
  }, [])

  const handleSliderChange = useCallback(
    (newTimeMinutes: number, newIncrementSeconds: number) => {
      setTimeMinutes(newTimeMinutes)
      setIncrementSeconds(newIncrementSeconds)

      if (newTimeMinutes === 0 && newIncrementSeconds === 0) {
        setTimeControl('unlimited')
      } else {
        const newTimeControl =
          `${newTimeMinutes}+${newIncrementSeconds}` as TimeControl
        if (TimeControlOptions.includes(newTimeControl)) {
          setTimeControl(newTimeControl)
        } else {
          setTimeControl(newTimeControl)
        }
      }
    },
    [],
  )

  const start = useCallback(
    (color: Color | undefined) => {
      const player = color ?? ['white', 'black'][Math.floor(Math.random() * 2)]

      if (fen && !new Chess().validateFen(fen).valid) {
        toast.error('Invalid Starting FEN provided')
        return
      }

      setPlaySetupModalProps(undefined)

      if (props.playType == 'againstMaia') {
        push({
          pathname: '/play/maia',
          query: {
            player: player,
            //maiaPartnerVersion: maiaPartnerVersion,
            maiaVersion: maiaVersion,
            timeControl: timeControl,
            sampleMoves: sampleMoves,
            simulateMaiaTime: simulateMaiaTime,
            startFen: fen,
          },
        })
      } else {
        push({
          pathname: '/play/hb',
          query: {
            player: player,
            maiaPartnerVersion: maiaPartnerVersion,
            maiaVersion: maiaVersion,
            timeControl: timeControl,
            isBrain: isBrain,
            sampleMoves: sampleMoves,
            simulateMaiaTime: simulateMaiaTime,
            startFen: fen,
          },
        })
      }
    },
    [
      setPlaySetupModalProps,
      props.playType,
      push,
      maiaPartnerVersion,
      maiaVersion,
      timeControl,
      sampleMoves,
      simulateMaiaTime,
      fen,
      isBrain,
    ],
  )

  return (
    <AnimatePresence>
      <ModalContainer dismiss={() => setPlaySetupModalProps(undefined)}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="border-glass-border relative flex h-[600px] w-[500px] max-w-[90vw] flex-col overflow-hidden rounded-lg border bg-glass backdrop-blur-md"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: [
                'radial-gradient(ellipse 130% 110% at 0% 0%, rgba(239, 68, 68, 0.04) 0%, transparent 75%)',
                'radial-gradient(ellipse 130% 110% at 100% 100%, rgba(239, 68, 68, 0.03) 0%, transparent 75%)',
              ].join(', '),
            }}
          />
          <button
            className="absolute right-4 top-4 z-10 text-secondary transition-colors hover:text-primary"
            title="Close"
            onClick={() => setPlaySetupModalProps(undefined)}
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          {/* Header */}
          <div className="border-glass-border border-b p-4">
            <h2 className="text-xl font-bold text-primary">
              {props.playType == 'againstMaia'
                ? 'Play Against Maia'
                : 'Play Hand and Brain'}
            </h2>
            <p className="text-xs text-secondary">
              {props.playType == 'againstMaia'
                ? 'Configure your game settings and choose your side'
                : 'Team up with Maia in Hand and Brain chess'}
            </p>
          </div>

          {/* Settings Section */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {props.playType == 'handAndBrain' ? (
                <>
                  <div>
                    <label
                      htmlFor="play-as-select"
                      className="mb-1 block text-sm font-medium text-primary"
                    >
                      Play as:
                    </label>
                    <div id="play-as-select">
                      <OptionSelect
                        options={[false, true]}
                        labels={['Hand', 'Brain']}
                        selected={isBrain}
                        onChange={setIsBrain}
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="partner-select"
                      className="mb-1 block text-sm font-medium text-primary"
                    >
                      Partner:
                    </label>
                    <select
                      id="partner-select"
                      value={maiaPartnerVersion}
                      className="border-glass-border w-full rounded border bg-glass px-3 py-2 text-sm text-white/90 focus:outline-none"
                      onChange={(e) => setMaiaPartnerVersion(e.target.value)}
                    >
                      {maiaOptions.map((maia) => (
                        <option key={`partner_${maia}`} value={maia}>
                          {maia.replace('maia_kdd_', 'Maia ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}

              <div>
                <label
                  htmlFor="opponent-select"
                  className="mb-1 block text-sm font-medium text-primary"
                >
                  Opponent:
                </label>
                <select
                  id="opponent-select"
                  value={maiaVersion}
                  className="border-glass-border w-full rounded border bg-glass px-3 py-2 text-sm text-white/90 focus:outline-none"
                  onChange={(e) => setMaiaVersion(e.target.value)}
                >
                  {maiaOptions.map((maia) => (
                    <option key={`opponent_${maia}`} value={maia}>
                      {maia.replace('maia_kdd_', 'Maia ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">
                    Time Control:
                  </span>
                  <div className="flex gap-1">
                    {TimeControlOptions.map((option, index) => (
                      <button
                        key={option}
                        onClick={() => handlePresetSelect(option)}
                        className={`rounded border px-2 py-1 text-xs font-medium transition-colors ${
                          timeControl === option
                            ? 'border-glass-border bg-glass-stronger text-white backdrop-blur-md'
                            : 'border-glass-border bg-glass text-white/90 hover:bg-glass-strong'
                        }`}
                      >
                        {TimeControlOptionNames[index]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label
                        htmlFor="time-minutes-slider"
                        className="text-xs font-medium text-primary"
                      >
                        Time (minutes)
                      </label>
                      <span className="text-xs text-secondary">
                        {timeMinutes}
                      </span>
                    </div>
                    <input
                      id="time-minutes-slider"
                      type="range"
                      min="0"
                      max="60"
                      step="1"
                      value={timeMinutes}
                      onChange={(e) =>
                        handleSliderChange(
                          Number(e.target.value),
                          incrementSeconds,
                        )
                      }
                      className="w-full accent-human-4"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label
                        htmlFor="increment-seconds-slider"
                        className="text-xs font-medium text-primary"
                      >
                        Increment (seconds)
                      </label>
                      <span className="text-xs text-secondary">
                        {incrementSeconds}
                      </span>
                    </div>
                    <input
                      id="increment-seconds-slider"
                      type="range"
                      min="0"
                      max="30"
                      step="1"
                      value={incrementSeconds}
                      onChange={(e) =>
                        handleSliderChange(timeMinutes, Number(e.target.value))
                      }
                      className="w-full accent-human-4"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="maia-timing-select"
                  className="mb-1 block text-sm font-medium text-primary"
                >
                  Maia thinking time:
                </label>
                <div id="maia-timing-select">
                  <OptionSelect
                    options={[false, true]}
                    labels={['Instant', 'Human-like']}
                    selected={simulateMaiaTime}
                    onChange={setSimulateMaiaTime}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="customPosition"
                  checked={fen !== undefined}
                  onChange={() => setFen(fen === undefined ? '' : undefined)}
                  className="accent-human-4"
                />
                <label
                  htmlFor="customPosition"
                  className="text-sm text-primary"
                >
                  Start from custom position
                </label>
              </div>

              {fen !== undefined && (
                <div className="border-glass-border rounded border bg-glass p-3">
                  <label
                    htmlFor="fen-input"
                    className="mb-1 block text-sm font-medium text-primary"
                  >
                    Starting FEN position:
                  </label>
                  <input
                    id="fen-input"
                    type="text"
                    value={fen}
                    placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                    onChange={(e) => setFen(e.target.value)}
                    className="border-glass-border w-full rounded border bg-glass px-3 py-2 font-mono text-xs text-white/90 placeholder-white/60 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-secondary">
                    Enter a valid FEN string to start from a specific position
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Color Selection Section */}
          <div className="border-glass-border border-t p-4">
            <p className="mb-3 text-center text-sm font-medium text-primary">
              Choose your color:
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => start('black')}
                title="Play as black"
                className="border-glass-border flex h-16 w-16 cursor-pointer items-center justify-center rounded border bg-glass transition-colors hover:bg-glass-stronger"
              >
                <div className="relative h-10 w-10">
                  <Image
                    src="/assets/pieces/black king.svg"
                    fill={true}
                    alt="Play as black"
                  />
                </div>
              </button>
              <button
                onClick={() => start(undefined)}
                title="Play as random color"
                className="border-glass-border flex h-20 w-20 cursor-pointer items-center justify-center rounded border bg-glass transition-colors hover:bg-glass-stronger"
              >
                <div className="relative h-12 w-12">
                  <Image
                    alt="Play as random color"
                    fill={true}
                    src="/assets/pieces/white black king.svg"
                  />
                </div>
              </button>
              <button
                onClick={() => start('white')}
                title="Play as white"
                className="border-glass-border flex h-16 w-16 cursor-pointer items-center justify-center rounded border bg-glass transition-colors hover:bg-glass-stronger"
              >
                <div className="relative h-10 w-10">
                  <Image
                    src="/assets/pieces/white king.svg"
                    fill={true}
                    alt="Play as white"
                  />
                </div>
              </button>
            </div>
          </div>
        </motion.div>
      </ModalContainer>
    </AnimatePresence>
  )
}
