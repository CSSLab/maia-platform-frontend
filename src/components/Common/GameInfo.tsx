import { useRef } from 'react'
import { useTour } from 'src/contexts'
import { InstructionsType } from 'src/types'
import { tourConfigs } from 'src/constants/tours'

interface Props {
  icon: string
  title: string
  type: InstructionsType
  children: React.ReactNode
  currentMaiaModel?: string
  setCurrentMaiaModel?: (model: string) => void
  MAIA_MODELS?: string[]
  showGameListButton?: boolean
  onGameListClick?: () => void
  streamState?: {
    isLive: boolean
    isConnected: boolean
    error: string | null
    gameEnded: boolean
  }
  mobileActions?: React.ReactNode
  embedded?: boolean
}

export const GameInfo: React.FC<Props> = ({
  icon,
  title,
  type,
  children,
  currentMaiaModel,
  setCurrentMaiaModel,
  MAIA_MODELS,
  showGameListButton,
  onGameListClick,
  streamState,
  mobileActions,
  embedded = false,
}: Props) => {
  const { startTour } = useTour()
  const maiaSelectRef = useRef<HTMLSelectElement | null>(null)
  const openMaiaModelPicker = () => {
    const select = maiaSelectRef.current as
      | (HTMLSelectElement & { showPicker?: () => void })
      | null
    if (!select) return

    select.focus()
    if (select.showPicker) {
      try {
        select.showPicker()
        return
      } catch {
        // Fallback for browsers/event timing that reject showPicker.
      }
    }
    select.click()
  }

  return (
    <div
      id="analysis-game-list"
      className={
        embedded
          ? 'flex w-full flex-col items-start justify-start gap-1 overflow-hidden border-b border-t border-glass-border bg-transparent px-4 py-2 md:border md:p-3'
          : 'flex w-full flex-col items-start justify-start gap-1 overflow-hidden border border-b border-t border-glass-border bg-glass px-4 py-2 backdrop-blur-md md:rounded-md md:border md:p-3'
      }
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center justify-start gap-1 md:gap-1.5">
          <span className="material-symbols-outlined inline-flex w-4 items-center justify-center text-base md:w-5 md:text-xl">
            {icon}
          </span>
          <div className="flex items-center gap-1">
            <h2 className="text-sm font-semibold leading-none md:text-lg">
              {title}
            </h2>
            {currentMaiaModel && setCurrentMaiaModel && (
              <div className="flex items-center gap-1 text-xs leading-none md:hidden md:text-sm">
                <span>using</span>
                <div className="relative inline-flex items-center gap-0.5">
                  <select
                    ref={maiaSelectRef}
                    value={currentMaiaModel}
                    className="cursor-pointer appearance-none bg-transparent leading-none focus:outline-none"
                    onChange={(e) => setCurrentMaiaModel(e.target.value)}
                  >
                    {MAIA_MODELS?.map((model) => (
                      <option value={model} key={model}>
                        {model.replace('maia_kdd_', 'Maia ')}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="material-symbols-outlined -ml-0.5 inline-flex h-4 items-center justify-center self-center align-middle text-sm leading-none"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      openMaiaModelPicker()
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openMaiaModelPicker()
                      }
                    }}
                    aria-label="Change Maia model"
                  >
                    arrow_drop_down
                  </button>
                </div>
              </div>
            )}
          </div>
          {streamState && (
            <div className="flex items-center gap-1.5">
              <div
                className={`h-2 w-2 rounded-full ${
                  streamState.isLive
                    ? 'animate-pulse bg-red-500'
                    : streamState.isConnected
                      ? 'bg-green-500'
                      : 'bg-gray-500'
                }`}
              />
              <span className="text-xs font-medium text-secondary">
                {streamState.isLive
                  ? 'LIVE'
                  : streamState.isConnected
                    ? 'Connected'
                    : streamState.gameEnded
                      ? 'Game Ended'
                      : streamState.error
                        ? 'Disconnected'
                        : 'Connecting...'}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mobileActions}
          {showGameListButton && (
            <button
              type="button"
              className="flex items-center gap-1 rounded bg-human-4/30 px-2 py-1 text-xxs text-human-2 duration-200 hover:bg-human-4/50 md:hidden md:text-sm"
              onClick={onGameListClick}
            >
              <span className="material-symbols-outlined text-xxs md:text-sm">
                format_list_bulleted
              </span>
              <span>
                Switch <span className="hidden md:inline">Game</span>
              </span>
            </button>
          )}
          <button
            type="button"
            className="material-symbols-outlined text-lg duration-200 hover:text-human-3 focus:outline-none"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()

              const tourTypeMap: { [key: string]: keyof typeof tourConfigs } = {
                againstMaia: 'play',
                handAndBrain: 'handBrain',
                analysis: 'analysis',
                train: 'train',
                turing: 'turing',
              }

              const tourType = tourTypeMap[type]
              if (tourType && tourConfigs[tourType]) {
                const tourConfig = tourConfigs[tourType]
                startTour(tourConfig.id, tourConfig.steps, true)
              }
            }}
          >
            help
          </button>
        </div>
      </div>
      <div className="flex w-full flex-col text-sm md:text-base">
        {children}
      </div>
    </div>
  )
}
