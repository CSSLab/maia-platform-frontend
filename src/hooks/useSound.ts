import { useContext } from 'react'
import { SoundContext, type SoundContextValue } from 'src/contexts/SoundContext'

export const useSound = (): SoundContextValue => {
  const ctx = useContext(SoundContext)
  if (!ctx) throw new Error('useSound must be used within SoundProvider')
  return ctx
}
