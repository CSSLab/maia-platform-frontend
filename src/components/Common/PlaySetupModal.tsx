import Image from 'next/image'
import { Chess } from 'chess.ts'
import toast from 'react-hot-toast'
import { useRouter } from 'next/router'
import { AnimatePresence } from 'framer-motion'
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
import { Slider } from './Slider'
import {
  customToPresetTimeControl,
  parseTimeControl,
  getPresetOptions,
} from 'src/lib/timeControlUtils'

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
                ? 'bg-human-4 text-white'
                : 'bg-background-2 text-primary hover:bg-background-3'
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
  const [useCustomTime, setUseCustomTime] = useState<boolean>(false)
  const [customMinutes, setCustomMinutes] = useState<number>(10)
  const [customIncrement, setCustomIncrement] = useState<number>(0)
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

  // Helper function to get the effective time control
  const getEffectiveTimeControl = (): TimeControl => {
    if (useCustomTime) {
      return customToPresetTimeControl(customMinutes, customIncrement)
    }
    return timeControl
  }

  const start = useCallback(
    (color: Color | undefined) => {
      const player = color ?? ['white', 'black'][Math.floor(Math.random() * 2)]
      const effectiveTimeControl = getEffectiveTimeControl()

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
            timeControl: effectiveTimeControl,
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
            timeControl: effectiveTimeControl,
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
      getEffectiveTimeControl,
      sampleMoves,
      simulateMaiaTime,
      fen,
      isBrain,
    ],
  )

  return (
    <AnimatePresence>
      <ModalContainer dismiss={() => setPlaySetupModalProps(undefined)}>
        <div className="relative flex h-[600px] w-[500px] max-w-[90vw] flex-col overflow-hidden rounded-lg bg-background-1">
          <button
            className="absolute right-4 top-4 z-10 text-secondary transition-colors hover:text-primary"
            title="Close"
            onClick={() => setPlaySetupModalProps(undefined)}
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          {/* Header */}
          <div className="border-b border-white/10 p-4">
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
                      className="w-full rounded bg-background-2 px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-human-4"
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
                  className="w-full rounded bg-background-2 px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-human-4"
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
                <label
                  htmlFor="time-control-select"
                  className="mb-2 block text-sm font-medium text-primary"
                >
                  Time control:
                </label>

                {/* Toggle between preset and custom */}
                <div className="mb-3">
                  <OptionSelect
                    options={[false, true]}
                    labels={['Preset', 'Custom']}
                    selected={useCustomTime}
                    onChange={setUseCustomTime}
                  />
                </div>

                {useCustomTime ? (
                  /* Custom time controls with sliders */
                  <div className="space-y-3 rounded bg-background-2 p-3">
                    <Slider
                      id="time-slider"
                      label="Time per side"
                      value={customMinutes}
                      min={1}
                      max={180}
                      step={1}
                      unit=" min"
                      onChange={setCustomMinutes}
                    />
                    <Slider
                      id="increment-slider"
                      label="Increment per move"
                      value={customIncrement}
                      min={0}
                      max={60}
                      step={1}
                      unit=" sec"
                      onChange={setCustomIncrement}
                    />
                    <div className="mt-2 text-center">
                      <span className="text-xs text-secondary">
                        Time control: {customMinutes}+{customIncrement}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Preset time controls */
                  <div id="time-control-select">
                    <OptionSelect
                      options={TimeControlOptions}
                      labels={TimeControlOptionNames}
                      selected={timeControl}
                      onChange={setTimeControl}
                    />
                  </div>
                )}
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
                <div className="rounded bg-background-2 p-3">
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
                    className="w-full rounded border border-background-3 bg-background-1 px-3 py-2 font-mono text-xs text-primary placeholder-secondary focus:border-human-4 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-secondary">
                    Enter a valid FEN string to start from a specific position
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Color Selection Section */}
          <div className="border-t border-white/10 p-4">
            <p className="mb-3 text-center text-sm font-medium text-primary">
              Choose your color:
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => start('black')}
                title="Play as black"
                className="flex h-16 w-16 cursor-pointer items-center justify-center rounded bg-background-2 transition-colors hover:bg-human-4"
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
                className="flex h-20 w-20 cursor-pointer items-center justify-center rounded bg-background-2 transition-colors hover:bg-human-4"
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
                className="flex h-16 w-16 cursor-pointer items-center justify-center rounded bg-background-2 transition-colors hover:bg-human-4"
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
        </div>
      </ModalContainer>
    </AnimatePresence>
  )
}
