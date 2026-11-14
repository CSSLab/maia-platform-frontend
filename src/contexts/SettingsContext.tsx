import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  getUserSettings,
  saveUserSettings,
  UserSettings,
} from 'src/lib/settings'
import { trackSettingChanged } from 'src/lib/analytics'

// The name each setting is reported under.
const REPORTED_AS = {
  soundEnabled: 'sound',
  chessboardTheme: 'board_theme',
} as const

interface SettingsContextType {
  settings: UserSettings
  updateSetting: <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ) => void
  resetSettings: () => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
)

interface Props {
  children: React.ReactNode
}

export const SettingsProvider: React.FC<Props> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(() =>
    getUserSettings(),
  )

  // Apply theme on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.body.className = document.body.className.replace(
        /theme-\w+/g,
        '',
      )
      document.body.classList.add(`theme-${settings.chessboardTheme}`)
    }
  }, [])

  const updateSetting = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ) => {
    const newSettings = {
      ...settings,
      [key]: value,
    }
    if (settings[key] !== value && key in REPORTED_AS) {
      trackSettingChanged(
        REPORTED_AS[key as keyof typeof REPORTED_AS],
        value as string | boolean,
      )
    }
    setSettings(newSettings)
    saveUserSettings(newSettings)

    // Apply theme changes to DOM immediately
    if (key === 'chessboardTheme' && typeof window !== 'undefined') {
      document.body.className = document.body.className.replace(
        /theme-\w+/g,
        '',
      )
      document.body.classList.add(`theme-${value}`)
    }
  }

  const resetSettings = () => {
    const defaultSettings: UserSettings = {
      soundEnabled: true,
      chessboardTheme: 'brown',
    }
    setSettings(defaultSettings)
    saveUserSettings(defaultSettings)
  }

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'maia-user-settings' && e.newValue) {
        try {
          const newSettings = JSON.parse(e.newValue) as UserSettings
          setSettings(newSettings)
        } catch (error) {
          console.warn('Failed to sync settings from storage change:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
