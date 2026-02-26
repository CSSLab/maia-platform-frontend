import { useWindowSize } from 'src/hooks'
import React, { ReactNode, useMemo } from 'react'

export const PHONE_BREAKPOINT_PX = 670
export const TABLET_BREAKPOINT_PX = 1024

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
  // `isMobile` is used by many layouts as the "stacked" layout trigger.
  // Include tablets so iPad widths do not fall into cramped desktop layouts.
  const isMobile = useMemo(
    () => width > 0 && width <= TABLET_BREAKPOINT_PX,
    [width],
  )
  return (
    <WindowSizeContext.Provider value={{ width, height, isMobile }}>
      {children}
    </WindowSizeContext.Provider>
  )
}
