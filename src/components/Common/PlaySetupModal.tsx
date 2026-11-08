import Image from 'next/image'
import toast from 'react-hot-toast'
import { useRouter } from 'next/router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import {
  Color,
  PlayType,
  TimeControl,
  TimeControlOptionNames,
  TimeControlOptions,
} from 'src/types'
import { ModalContext } from 'src/contexts/ModalContext'
import { startGameEarly } from 'src/api/play'
import { noteOpponentChoice } from 'src/lib/opponentChoice'
import {
  MAIA_VERSIONS as maiaOptions,
  PlaySetupInitialState,
  loadPlaySettings,
  playSetupInitialState,
  savePlaySettings,
} from 'src/lib/playSettings'
import { checkStartPosition } from 'src/lib/startPosition'
import {
  INCREMENT_SECONDS_STEPS,
  TIME_MINUTES_STEPS,
  nearestStepIndex,
} from 'src/lib/timeControl'
import {
  UnfinishedGame,
  clearUnfinishedGame,
  loadUnfinishedGame,
} from 'src/lib/unfinishedGame'
import { ModalContainer } from './ModalContainer'

const subscribeToNothing = () => () => undefined

interface OptionSelectProps<T> {
  options: T[]
  labels: string[]
  selected: T
  onChange: (selected: T) => void
  selectedClassName?: string
  unselectedClassName?: string
}

function OptionSelect<T>({
  options,
  labels,
  selected,
  onChange,
  selectedClassName = 'border border-glass-border bg-glass-stronger text-white',
  unselectedClassName = 'border border-glass-border bg-glass text-white/90 hover:bg-glass-stronger',
}: OptionSelectProps<T>) {
  return (
    <div className="flex overflow-hidden rounded-lg">
      {options.map((option, index) => {
        return (
          <button
            key={index}
            className={`flex-1 whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
              option === selected ? selectedClassName : unselectedClassName
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

export interface PlaySetupModalProps {
  playType: PlayType
  player?: Color
  timeControl?: TimeControl
  maiaPartnerVersion?: string
  maiaVersion?: string
  isBrain?: boolean
  sampleMoves?: boolean
  simulateMaiaTime?: boolean
  practice?: boolean
  startFen?: string
  returnTo?: string
  challengeId?: string
  forcedPlayerColor?: Color
  modalTitle?: string
  modalSubtitle?: string
  // Called when the dialog closes (dismissed, or a game started), besides
  // clearing ModalContext's dialog: for a page that renders it itself.
  onClose?: () => void
  // false: shown without fading and sliding in (see /play).
  animateIn?: boolean
}

export const PlaySetupModal: React.FC<PlaySetupModalProps> = (
  props: PlaySetupModalProps,
) => {
  const { setPlaySetupModalProps } = useContext(ModalContext)
  const router = useRouter()
  const { push } = router

  // Fetch the game page's code while the visitor chooses, so that it is
  // ready when they start (it otherwise waited behind the prefetches of the
  // header's links).
  const gamePath = props.playType === 'againstMaia' ? '/play/maia' : '/play/hb'
  useEffect(() => {
    router.prefetch(gamePath).catch(() => undefined)
  }, [router, gamePath])

  // Until the app has started, the dialog (in /play's server HTML) ignores
  // taps: a choice made before then would show but not be used.
  const [interactive, setInteractive] = useState(false)
  useEffect(() => setInteractive(true), [])

  const { onClose } = props
  const dismissModal = useCallback(() => {
    setPlaySetupModalProps(undefined)
    onClose?.()

    // On /play the dialog is the page: closing it leaves for the page the
    // visitor came to play from (returnTo), or the home page, rather than an
    // empty page.
    if (router.pathname === '/play') {
      push(
        props.returnTo && router.asPath !== props.returnTo
          ? props.returnTo
          : '/',
      )
    }
  }, [
    props.returnTo,
    push,
    router.asPath,
    router.pathname,
    setPlaySetupModalProps,
    onClose,
  ])

  const forcedPlayerColor = props.forcedPlayerColor
  const colorSelectionLocked = forcedPlayerColor !== undefined
  const positionLocked = forcedPlayerColor !== undefined

  // The dialog starts from its props, then the settings of the last game
  // started in this browser (src/lib/playSettings.ts), then the defaults.
  // /play renders it in the server's HTML, which can't know what this
  // browser saved: while hydrating that HTML (useSyncExternalStore gives its
  // server value then) it starts from the defaults as the server did, and
  // takes the saved settings once mounted. The dialog ignores taps until
  // then anyway (`interactive`). Opened later (ModalContext, or /play reached
  // in the app), it starts from them at once, without a visible change.
  const hydrating = useSyncExternalStore(
    subscribeToNothing,
    () => false,
    () => true,
  )
  const initialProps = {
    playType: props.playType,
    timeControl: props.timeControl,
    maiaVersion: props.maiaVersion,
    maiaPartnerVersion: props.maiaPartnerVersion,
    isBrain: props.isBrain,
    simulateMaiaTime: props.simulateMaiaTime,
    practice: props.practice,
    startFen: props.startFen,
  }
  const [initial] = useState<PlaySetupInitialState>(() =>
    playSetupInitialState(
      initialProps,
      hydrating ? {} : loadPlaySettings(props.playType),
    ),
  )

  const [timeControl, setTimeControl] = useState<TimeControl>(
    initial.timeControl,
  )
  // The sliders' minutes and increment (kept while Unlimited is chosen, for
  // when the slider is moved back).
  const [timeMinutes, setTimeMinutes] = useState<number>(initial.timeMinutes)
  const [incrementSeconds, setIncrementSeconds] = useState<number>(
    initial.incrementSeconds,
  )
  const [isBrain, setIsBrain] = useState<boolean>(initial.isBrain)
  const [sampleMoves, setSampleMoves] = useState<boolean>(
    props.sampleMoves || true,
  )
  const [simulateMaiaTime, setSimulateMaiaTime] = useState<boolean>(
    initial.simulateMaiaTime,
  )
  const [practice, setPractice] = useState<boolean>(initial.practice)

  // An unlimited or practice game vs Maia left unfinished in this browser,
  // offered to continue (read after the first render: the dialog is in /play's
  // server HTML).
  const [unfinishedGame, setUnfinishedGame] = useState<UnfinishedGame | null>(
    null,
  )
  // Shown for Hand & Brain too: starting any game resigns it.
  useEffect(() => {
    setUnfinishedGame(loadUnfinishedGame())
  }, [])

  const continueUnfinishedGame = useCallback(() => {
    if (!unfinishedGame) return
    const { config } = unfinishedGame
    setPlaySetupModalProps(undefined)
    onClose?.()
    push({
      pathname: '/play/maia',
      query: {
        player: config.player,
        maiaVersion: config.maiaVersion,
        timeControl: config.timeControl,
        sampleMoves: config.sampleMoves,
        simulateMaiaTime: config.simulateMaiaTime ?? true,
        startFen: config.startFen,
        practice: !!config.practice,
      },
    })
  }, [unfinishedGame, setPlaySetupModalProps, onClose, push])

  const [maiaPartnerVersion, setMaiaPartnerVersion] = useState<string>(
    initial.maiaPartnerVersion,
  )
  const [maiaVersion, setMaiaVersion] = useState<string>(initial.maiaVersion)
  const [fen, setFen] = useState<string | undefined>(initial.fen)
  // An empty box starts from the usual position.
  const fenCheck = fen?.trim() ? checkStartPosition(fen) : undefined
  const startFen = fenCheck?.ok ? fenCheck.fen : undefined

  // Opened with a position that can't be played (from a link, say): the
  // box and what's wrong with it are below the fold, so show them.
  const fenInputRef = useRef<HTMLInputElement>(null)
  const openedWithBadFen = useRef(fenCheck !== undefined && !fenCheck.ok)
  useEffect(() => {
    if (openedWithBadFen.current) {
      fenInputRef.current?.scrollIntoView({ block: 'center' })
    }
  }, [])

  // After hydrating /play's server HTML (see above), the saved settings.
  const savedSettingsLoaded = useRef(!hydrating)
  useEffect(() => {
    if (savedSettingsLoaded.current) return
    savedSettingsLoaded.current = true
    const saved = loadPlaySettings(props.playType)
    if (Object.keys(saved).length === 0) return
    const state = playSetupInitialState(initialProps, saved)
    setTimeControl(state.timeControl)
    setTimeMinutes(state.timeMinutes)
    setIncrementSeconds(state.incrementSeconds)
    setIsBrain(state.isBrain)
    setSimulateMaiaTime(state.simulateMaiaTime)
    setPractice(state.practice)
    setMaiaPartnerVersion(state.maiaPartnerVersion)
    setMaiaVersion(state.maiaVersion)
    setFen(state.fen)
    // Once, on mounting: later prop changes remount the dialog (/play's key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [openMoreOptions, setMoreOptionsOpen] = useState<boolean>(true)
  const compactHandBrainLayout = props.playType === 'handAndBrain'
  const modalTitle =
    props.modalTitle ||
    (props.playType == 'againstMaia'
      ? 'Play Against Maia'
      : 'Play Hand and Brain')
  const modalSubtitle =
    props.modalSubtitle ||
    (props.playType == 'againstMaia'
      ? 'Configure your game settings and choose your side'
      : 'Team up with Maia in Hand and Brain chess')

  const handlePresetSelect = useCallback((preset: TimeControl) => {
    setTimeControl(preset)
    if (preset !== 'unlimited') {
      const [minutes, increment] = preset.split('+').map(Number)
      setTimeMinutes(minutes)
      setIncrementSeconds(increment)
    }
  }, [])

  // `newTimeMinutes` null: Unlimited (the minutes slider's last position).
  const handleSliderChange = useCallback(
    (newTimeMinutes: number | null, newIncrementSeconds: number) => {
      if (newTimeMinutes === null) {
        setTimeControl('unlimited')
        return
      }
      // A game needs some time: with no base time ("0+N", which starts at
      // 3 seconds) there must be an increment.
      const increment =
        newTimeMinutes === 0 && newIncrementSeconds === 0
          ? 1
          : newIncrementSeconds
      setTimeMinutes(newTimeMinutes)
      setIncrementSeconds(increment)
      setTimeControl(`${newTimeMinutes}+${increment}` as TimeControl)
    },
    [],
  )
  const isUnlimited = timeControl === 'unlimited'

  const start = useCallback(
    (color: Color | undefined) => {
      if (
        forcedPlayerColor &&
        color !== undefined &&
        color !== forcedPlayerColor
      ) {
        return
      }

      const player = color ?? ['white', 'black'][Math.floor(Math.random() * 2)]
      const resolvedPlayer = forcedPlayerColor ?? player

      if (fenCheck && !fenCheck.ok) {
        toast.error(fenCheck.error)
        return
      }

      setPlaySetupModalProps(undefined)
      onClose?.()
      // A new game resigns any unfinished one (on the backend, as it starts).
      clearUnfinishedGame()

      // Next time the dialog starts from these choices. Not a challenge's:
      // those settings were set for the visitor, not chosen by them.
      if (!props.challengeId && forcedPlayerColor === undefined) {
        const shared = {
          maiaVersion,
          timeControl,
          timeMinutes,
          incrementSeconds,
          simulateMaiaTime,
        }
        savePlaySettings(
          props.playType,
          props.playType === 'againstMaia'
            ? { ...shared, practice }
            : { ...shared, maiaPartnerVersion, isBrain },
        )
      }

      // For the game's analytics: kept as offered (the last one played, or
      // the first), or changed.
      noteOpponentChoice(
        maiaVersion,
        maiaVersion === initial.maiaVersion ? 'preselected' : 'changed',
      )

      if (props.playType == 'againstMaia') {
        startGameEarly(
          resolvedPlayer as Color,
          maiaVersion,
          sampleMoves,
          timeControl,
        )
        push({
          pathname: '/play/maia',
          query: {
            player: resolvedPlayer,
            //maiaPartnerVersion: maiaPartnerVersion,
            maiaVersion: maiaVersion,
            timeControl: timeControl,
            sampleMoves: sampleMoves,
            simulateMaiaTime: simulateMaiaTime,
            startFen: startFen,
            practice: practice,
            returnTo: props.returnTo,
            challengeId: props.challengeId,
            forcedColor: forcedPlayerColor,
            modalTitle: props.modalTitle,
            modalSubtitle: props.modalSubtitle,
          },
        })
      } else {
        push({
          pathname: '/play/hb',
          query: {
            player: resolvedPlayer,
            maiaPartnerVersion: maiaPartnerVersion,
            maiaVersion: maiaVersion,
            timeControl: timeControl,
            isBrain: isBrain,
            sampleMoves: sampleMoves,
            simulateMaiaTime: simulateMaiaTime,
            startFen: startFen,
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
      practice,
      startFen,
      fenCheck,
      timeMinutes,
      incrementSeconds,
      forcedPlayerColor,
      isBrain,
      props.challengeId,
      props.modalSubtitle,
      props.modalTitle,
      props.returnTo,
      onClose,
      initial.maiaVersion,
    ],
  )

  return (
    <AnimatePresence>
      <ModalContainer dismiss={dismissModal} animateIn={props.animateIn}>
        <motion.div
          initial={props.animateIn === false ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`relative flex ${
            compactHandBrainLayout ? 'h-[640px]' : 'h-[600px]'
          } w-[500px] max-w-[90vw] flex-col overflow-hidden rounded-lg border border-glass-border bg-glass backdrop-blur-md ${
            interactive ? '' : 'pointer-events-none'
          }`}
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
            onClick={dismissModal}
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          {/* Header */}
          <div
            className={`border-b border-glass-border ${
              compactHandBrainLayout ? 'px-4 py-3' : 'p-4'
            }`}
          >
            <h2 className="text-xl font-bold text-primary">{modalTitle}</h2>
            <p className="text-xs text-secondary">{modalSubtitle}</p>
          </div>

          {/* Settings Section */}
          <div
            className={`flex-1 overflow-y-auto ${
              compactHandBrainLayout ? 'p-3' : 'p-4'
            }`}
          >
            <div className="space-y-4">
              {unfinishedGame && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-human-4/50 bg-human-4/10 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary">
                      Unfinished game vs{' '}
                      {unfinishedGame.config.maiaVersion.replace(
                        'maia_kdd_',
                        'Maia-3 ',
                      )}
                    </p>
                    <p className="text-xs text-secondary">
                      Starting a new game resigns the unfinished game
                    </p>
                  </div>
                  <button
                    onClick={continueUnfinishedGame}
                    className="shrink-0 rounded-md bg-human-4 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-human-4/90"
                  >
                    Continue
                  </button>
                </div>
              )}
              {props.playType == 'handAndBrain' ? (
                <>
                  <div>
                    <div className="grid grid-cols-[auto,1fr] items-center gap-3">
                      <label
                        htmlFor="play-as-select"
                        className="whitespace-nowrap text-sm font-medium text-primary"
                      >
                        Play as:
                      </label>
                      <div id="play-as-select" className="min-w-0">
                        <OptionSelect
                          options={[false, true]}
                          labels={['Hand', 'Brain']}
                          selected={isBrain}
                          onChange={setIsBrain}
                          selectedClassName="border-human-4 bg-human-4 text-white hover:bg-human-4/90"
                        />
                      </div>
                    </div>
                    <p className="mt-0.5 text-xxs leading-tight text-secondary">
                      Hand makes the move; Brain chooses which piece type must
                      be moved.
                    </p>
                  </div>
                  <div>
                    <div className="grid grid-cols-[auto,1fr] items-center gap-3">
                      <label
                        htmlFor="partner-select"
                        className="whitespace-nowrap text-sm font-medium text-primary"
                      >
                        Partner:
                      </label>
                      <select
                        id="partner-select"
                        value={maiaPartnerVersion}
                        className="edge-dark-select w-full min-w-0 rounded border border-glass-border bg-glass px-3 py-2 text-sm text-white/90 focus:outline-none"
                        onChange={(e) => setMaiaPartnerVersion(e.target.value)}
                      >
                        {maiaOptions.map((maia) => (
                          <option key={`partner_${maia}`} value={maia}>
                            {maia.replace('maia_kdd_', 'Maia-3 ')}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-0.5 text-xxs leading-tight text-secondary">
                      {isBrain
                        ? `${maiaPartnerVersion.replace('maia_kdd_', 'Maia-3 ')} is your Hand and will make the move on the board.`
                        : `${maiaPartnerVersion.replace('maia_kdd_', 'Maia-3 ')} is your Brain and will choose which piece type must be moved.`}
                    </p>
                  </div>
                </>
              ) : null}

              <div>
                <div className="grid grid-cols-[auto,1fr] items-center gap-3">
                  <label
                    htmlFor="opponent-select"
                    className="whitespace-nowrap text-sm font-medium text-primary"
                  >
                    Opponent:
                  </label>
                  <select
                    id="opponent-select"
                    value={maiaVersion}
                    className="edge-dark-select w-full min-w-0 rounded border border-glass-border bg-glass px-3 py-2 text-sm text-white/90 focus:outline-none"
                    onChange={(e) => setMaiaVersion(e.target.value)}
                  >
                    {maiaOptions.map((maia) => (
                      <option key={`opponent_${maia}`} value={maia}>
                        {maia.replace('maia_kdd_', 'Maia-3 ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                {/* On phones the label sits above the buttons, which share
                    the row's width, so that "Unlimited" fits. */}
                <div
                  className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${
                    compactHandBrainLayout ? 'mb-2' : 'mb-3'
                  }`}
                >
                  <span className="whitespace-nowrap text-sm font-medium text-primary">
                    Time Control:
                  </span>
                  <div className="flex gap-1.5">
                    {TimeControlOptions.map((option, index) => (
                      <button
                        key={option}
                        onClick={() => handlePresetSelect(option)}
                        className={`flex-1 whitespace-nowrap rounded border px-1.5 py-1 text-xs font-medium transition-colors sm:flex-none sm:px-2 ${
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

                <div
                  className={
                    compactHandBrainLayout ? 'space-y-2.5' : 'space-y-3'
                  }
                >
                  <div>
                    <div
                      className={`flex items-center justify-between ${
                        compactHandBrainLayout ? 'mb-1' : 'mb-2'
                      }`}
                    >
                      <label
                        htmlFor="time-minutes-slider"
                        className="text-xs font-medium text-primary"
                      >
                        Time (minutes)
                      </label>
                      <span className="text-xs text-secondary">
                        {isUnlimited ? 'Unlimited' : timeMinutes}
                      </span>
                    </div>
                    <input
                      id="time-minutes-slider"
                      type="range"
                      min="0"
                      max={TIME_MINUTES_STEPS.length}
                      step="1"
                      value={
                        isUnlimited
                          ? TIME_MINUTES_STEPS.length
                          : nearestStepIndex(TIME_MINUTES_STEPS, timeMinutes)
                      }
                      onChange={(e) =>
                        handleSliderChange(
                          TIME_MINUTES_STEPS[Number(e.target.value)] ?? null,
                          incrementSeconds,
                        )
                      }
                      className="w-full accent-human-4"
                    />
                  </div>

                  <div>
                    <div
                      className={`flex items-center justify-between ${
                        compactHandBrainLayout ? 'mb-1' : 'mb-2'
                      }`}
                    >
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
                      max={INCREMENT_SECONDS_STEPS.length - 1}
                      step="1"
                      value={nearestStepIndex(
                        INCREMENT_SECONDS_STEPS,
                        incrementSeconds,
                      )}
                      disabled={isUnlimited}
                      onChange={(e) =>
                        handleSliderChange(
                          timeMinutes,
                          INCREMENT_SECONDS_STEPS[Number(e.target.value)],
                        )
                      }
                      className="w-full accent-human-4 disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[auto,1fr] sm:items-center sm:gap-3">
                  <label
                    htmlFor="maia-timing-select"
                    className="whitespace-nowrap text-sm font-medium text-primary"
                  >
                    Maia thinking time:
                  </label>
                  <div id="maia-timing-select" className="min-w-0">
                    <OptionSelect
                      options={[false, true]}
                      labels={['Instant', 'Human-like']}
                      selected={simulateMaiaTime}
                      onChange={setSimulateMaiaTime}
                      selectedClassName="border-human-4 bg-human-4 text-white hover:bg-human-4/90"
                    />
                  </div>
                </div>
              </div>

              {props.playType === 'againstMaia' && (
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="practiceMode"
                    checked={practice}
                    onChange={() => setPractice(!practice)}
                    className="mt-0.5 accent-human-4"
                  />
                  <label
                    htmlFor="practiceMode"
                    className="text-sm text-primary"
                  >
                    Practice mode{' '}
                    <span className="text-xs text-secondary">
                      (unrated, with takebacks and extra time)
                    </span>
                  </label>
                </div>
              )}

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
                <div className="rounded border border-glass-border bg-glass p-3">
                  <label
                    htmlFor="fen-input"
                    className="mb-1 block text-sm font-medium text-primary"
                  >
                    Starting FEN position:
                  </label>
                  <input
                    id="fen-input"
                    ref={fenInputRef}
                    type="text"
                    value={fen}
                    placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                    readOnly={positionLocked}
                    aria-invalid={fenCheck ? !fenCheck.ok : undefined}
                    aria-describedby={
                      fenCheck && !fenCheck.ok ? 'fen-input-error' : undefined
                    }
                    onChange={(e) => setFen(e.target.value)}
                    className={`w-full rounded border border-glass-border px-3 py-2 font-mono text-xs placeholder-white/60 focus:outline-none ${
                      positionLocked
                        ? 'bg-glass text-white/90'
                        : 'bg-glass text-white/90'
                    }`}
                  />
                  {fenCheck && !fenCheck.ok ? (
                    <p
                      id="fen-input-error"
                      className="mt-1 text-xs text-red-400"
                      aria-live="polite"
                    >
                      {fenCheck.error}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-secondary">
                      {positionLocked
                        ? 'This challenge uses a fixed starting position.'
                        : 'Enter a valid FEN string to start from a specific position'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Color Selection Section */}
          <div
            className={`border-t border-glass-border ${
              compactHandBrainLayout ? 'p-3' : 'p-4'
            }`}
          >
            <p
              className={`text-center text-sm font-medium text-primary ${
                compactHandBrainLayout ? 'mb-2' : 'mb-3'
              }`}
            >
              Choose your color:
            </p>
            {colorSelectionLocked ? (
              <p className="mb-3 text-center text-xs text-secondary">
                This challenge starts with{' '}
                {forcedPlayerColor === 'white' ? 'White' : 'Black'} to move.
              </p>
            ) : null}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => start('black')}
                title="Play as black"
                disabled={colorSelectionLocked && forcedPlayerColor !== 'black'}
                className={`flex h-16 w-16 items-center justify-center rounded border border-glass-border transition-colors ${
                  colorSelectionLocked && forcedPlayerColor !== 'black'
                    ? 'cursor-not-allowed bg-glass/40 opacity-40'
                    : 'cursor-pointer bg-glass hover:bg-glass-stronger'
                }`}
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
                disabled={colorSelectionLocked}
                className={`flex h-20 w-20 items-center justify-center rounded border border-glass-border transition-colors ${
                  colorSelectionLocked
                    ? 'cursor-not-allowed bg-glass/40 opacity-40'
                    : 'cursor-pointer bg-glass hover:bg-glass-stronger'
                }`}
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
                disabled={colorSelectionLocked && forcedPlayerColor !== 'white'}
                className={`flex h-16 w-16 items-center justify-center rounded border border-glass-border transition-colors ${
                  colorSelectionLocked && forcedPlayerColor !== 'white'
                    ? 'cursor-not-allowed bg-glass/40 opacity-40'
                    : 'cursor-pointer bg-glass hover:bg-glass-stronger'
                }`}
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
