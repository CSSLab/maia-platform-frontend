import { ReactNode } from 'react'
import { TourProvider as TourContextProvider } from 'src/contexts/TourContext'

export const TourProvider: React.FC<{ children: ReactNode }> = ({
  children,
}: {
  children: ReactNode
}) => {
  return <TourContextProvider>{children}</TourContextProvider>
}
