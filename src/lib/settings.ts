export interface UserSettings {
  soundEnabled: boolean
  chessboardTheme:
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
}

const SETTINGS_KEY = 'maia-user-settings'

const DEFAULT_SETTINGS: UserSettings = {
  soundEnabled: true,
  chessboardTheme: 'brown',
}

export const getUserSettings = (): UserSettings => {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (!stored) {
      return DEFAULT_SETTINGS
    }

    const parsed = JSON.parse(stored) as Partial<UserSettings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    }
  } catch (error) {
    console.warn('Failed to parse user settings from localStorage:', error)
    return DEFAULT_SETTINGS
  }
}

export const saveUserSettings = (settings: UserSettings): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (error) {
    console.warn('Failed to save user settings to localStorage:', error)
  }
}

export const updateUserSetting = <K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K],
): void => {
  const currentSettings = getUserSettings()
  const newSettings = {
    ...currentSettings,
    [key]: value,
  }
  saveUserSettings(newSettings)
}
