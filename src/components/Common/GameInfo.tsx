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
}: Props) => {
  const { startTour } = useTour()

  return (
    <div
      id="analysis-game-list"
      className="flex w-full flex-col items-start justify-start gap-1 overflow-hidden rounded-md border border-glassBorder bg-glass p-3 backdrop-blur-md"
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center justify-start gap-1.5">
          <span className="material-symbols-outlined text-lg md:text-xl">
            {icon}
          </span>
          <h2 className="text-lg font-semibold md:text-xl">{title}</h2>
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
          {currentMaiaModel && setCurrentMaiaModel && (
            <div className="flex items-center gap-1 text-sm md:hidden">
              using
              <div className="relative inline-flex items-center gap-0.5">
                <select
                  value={currentMaiaModel}
                  className="cursor-pointer appearance-none bg-transparent focus:outline-none"
                  onChange={(e) => setCurrentMaiaModel(e.target.value)}
                >
                  {MAIA_MODELS?.map((model) => (
                    <option value={model} key={model}>
                      {model.replace('maia_kdd_', 'Maia ')}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined pointer-events-none text-sm">
                  arrow_drop_down
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showGameListButton && (
            <button
              type="button"
              className="flex items-center gap-1 rounded bg-human-4/30 px-2 py-1 text-sm text-human-2 duration-200 hover:bg-human-4/50 md:hidden"
              onClick={onGameListClick}
            >
              <span className="material-symbols-outlined text-sm">
                format_list_bulleted
              </span>
              <span>Switch Game</span>
            </button>
          )}
          <button
            type="button"
            className="material-symbols-outlined duration-200 hover:text-human-3 focus:outline-none"
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
