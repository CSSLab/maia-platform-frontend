import React from 'react'
import { useSettings } from 'src/contexts/SettingsContext'
import { useSound } from 'src/hooks/useSound'

export const SoundSettings: React.FC = () => {
  const { settings, updateSetting } = useSettings()
  const { playMoveSound } = useSound()

  const handleToggleSound = () => {
    const newValue = !settings.soundEnabled
    updateSetting('soundEnabled', newValue)
  }

  const handleTestSound = () => {
    if (settings.soundEnabled) {
      playMoveSound(false) // Test regular move sound
    }
  }

  const handleTestCaptureSound = () => {
    if (settings.soundEnabled) {
      playMoveSound(true) // Test capture sound
    }
  }

  return (
    <div className="group flex flex-col gap-4 rounded-lg border border-glassBorder bg-glass p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white/95">Sound Settings</h3>
      </div>

      <div className="flex flex-col gap-4">
        {/* Sound Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white/90">
              Enable Move Sounds
            </span>
            <p className="text-xs text-white/70">
              Play sounds when chess pieces are moved or captured
            </p>
          </div>
          <label
            htmlFor="sound-toggle"
            className="relative inline-flex cursor-pointer items-center"
          >
            <input
              id="sound-toggle"
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={handleToggleSound}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-white/10 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-white/20 after:bg-white after:transition-all after:content-[''] peer-checked:bg-red-500/40 peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-red-400 peer-focus:outline-none"></div>
            <span className="sr-only">Toggle move sounds</span>
          </label>
        </div>

        {/* Test Buttons (always visible) */}
        <div className="flex flex-col gap-2">
          <p className="text-sm text-white/70">Test sounds:</p>
          <div className="flex gap-2">
            <button
              onClick={handleTestSound}
              disabled={!settings.soundEnabled}
              className="group flex items-center gap-2 rounded-md border border-glassBorder bg-glass-strong px-3 py-2 text-sm text-white/90 transition-all duration-200 hover:bg-glass-stronger disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base text-white/80">
                volume_up
              </span>
              Move Sound
            </button>
            <button
              onClick={handleTestCaptureSound}
              disabled={!settings.soundEnabled}
              className="group flex items-center gap-2 rounded-md border border-glassBorder bg-glass-strong px-3 py-2 text-sm text-white/90 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base text-white/80">
                volume_up
              </span>
              Capture Sound
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
