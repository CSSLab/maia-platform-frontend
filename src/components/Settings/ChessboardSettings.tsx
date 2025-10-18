import React from 'react'
import { useSettings } from 'src/contexts/SettingsContext'
import Chessground from '@react-chess/chessground'

type ChessboardTheme =
  | 'brown'
  | 'blue'
  | 'blue2'
  | 'blue3'
  | 'blue-marble'
  | 'canvas2'
  | 'wood'
  | 'wood2'
  | 'wood3'
  | 'wood4'
  | 'maple'
  | 'maple2'
  | 'leather'
  | 'green'
  | 'pink-pyramid'
  | 'marble'
  | 'green-plastic'
  | 'grey'
  | 'metal'
  | 'olive'
  | 'newspaper'
  | 'purple'
  | 'purple-diag'
  | 'ic'
  | 'horsey'
  | 'wood-worn'
  | 'putt-putt'
  | 'cocoa'
  | 'parchment'

// Flattened list of all themes
const ALL_THEMES: ChessboardTheme[] = [
  'brown',
  'blue',
  'blue2',
  'blue3',
  'blue-marble',
  'canvas2',
  'wood',
  'wood2',
  'wood3',
  'wood4',
  'maple',
  'maple2',
  'green',
  'marble',
  'green-plastic',
  'grey',
  'metal',
  'newspaper',
  'ic',
  'purple',
  'purple-diag',
  'pink-pyramid',
  'leather',
  'olive',
  'horsey',
  'wood-worn',
  'putt-putt',
  'cocoa',
  'parchment',
]

export const ChessboardSettings: React.FC = () => {
  const { settings, updateSetting } = useSettings()

  const handleThemeChange = (theme: ChessboardTheme) => {
    updateSetting('chessboardTheme', theme)
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-glass-border bg-glass px-5 pb-0 pt-5">
      <div className="flex flex-col items-start justify-between">
        <h3 className="text-lg font-semibold text-white/95">
          Chessboard Theme
        </h3>
        <p className="text-sm text-white/70">
          Choose your preferred chessboard style. Changes will apply to all
          chess boards across the platform.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Theme Grid */}
        <div className="flex flex-row flex-wrap justify-around gap-3">
          {ALL_THEMES.map((theme) => (
            <label
              key={theme}
              className={`group relative flex cursor-pointer select-none items-center justify-center overflow-hidden rounded-md border p-2 text-white/90 backdrop-blur-md transition-all duration-300 ${
                settings.chessboardTheme === theme
                  ? 'border-red-500/40 bg-gradient-to-br from-red-500/15 to-red-500/5 shadow-white/5'
                  : 'from-white/8 to-white/4 hover:from-white/12 hover:to-white/6 border-glass-border bg-gradient-to-br hover:-translate-y-0.5 hover:border-white/20 hover:shadow-md hover:shadow-white/5'
              }`}
            >
              <input
                type="radio"
                name="chessboard-theme"
                value={theme}
                checked={settings.chessboardTheme === theme}
                onChange={() => handleThemeChange(theme)}
                className="sr-only"
              />
              <div
                className={`theme-preview-${theme} aspect-square h-16 min-h-16 w-16 min-w-16 overflow-hidden rounded`}
              >
                <Chessground
                  contained
                  config={{
                    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                    viewOnly: true,
                    coordinates: false,
                  }}
                />
              </div>
            </label>
          ))}
        </div>

        <div className="-mx-5 mt-1 border-t border-glass-border px-5 py-4 text-white/80">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined inline !text-base text-white/70">
              info
            </span>
            <p className="text-sm">
              Theme changes take effect immediately and will be remembered
              across browser sessions. Preview shows how the board will appear
              in games.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
