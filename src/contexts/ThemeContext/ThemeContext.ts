import React from 'react'

import { Theme } from 'src/types'

interface IThemeContext {
  theme: Theme
  toggleTheme: VoidFunction
}

export const ThemeContext = React.createContext<IThemeContext>({
  theme: 'light',
  toggleTheme: () => {
    throw new Error('poorly provided ThemeContext, missing toggle Theme')
  },
})
