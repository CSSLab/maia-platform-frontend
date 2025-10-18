import { useWindowSize } from 'src/hooks'
import React, { ReactNode, useMemo } from 'react'

interface IWindowSizeContext {
  height: number
  width: number
  isMobile: boolean
}

export const WindowSizeContext = React.createContext<IWindowSizeContext>({
  height: 0,
  width: 0,
  isMobile: false,
})

export const WindowSizeContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}: {
  children: ReactNode
}) => {
  const { width, height } = useWindowSize()
  const isMobile = useMemo(() => width > 0 && width <= 670, [width])
  return (
    <WindowSizeContext.Provider value={{ width, height, isMobile }}>
      {children}
    </WindowSizeContext.Provider>
  )
}
