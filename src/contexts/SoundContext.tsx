import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSettings } from 'src/contexts/SettingsContext'

type SoundType = 'move' | 'capture'

export interface SoundContextValue {
  playMoveSound: (isCapture?: boolean) => void
  ready: boolean
}

export const SoundContext = createContext<SoundContextValue | undefined>(
  undefined,
)

interface Props {
  children: React.ReactNode
}

export const SoundProvider: React.FC<Props> = ({ children }) => {
  const { settings } = useSettings()

  const ctxRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const buffersRef = useRef<Map<SoundType, AudioBuffer>>(new Map())
  const lastTypeRef = useRef<SoundType | null>(null)
  const lastPlayedAtMsRef = useRef(0)
  const initializedRef = useRef(false)

  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (initializedRef.current || typeof window === 'undefined') return
    initializedRef.current = true

    let canceled = false

    const init = async () => {
      try {
        const AudioCtx: typeof AudioContext | undefined =
          (window as any).AudioContext || (window as any).webkitAudioContext
        if (!AudioCtx) {
          console.warn('Web Audio API not supported; sounds disabled')
          setReady(false)
          return
        }

        const ctx = new AudioCtx()
        const gain = ctx.createGain()
        gain.connect(ctx.destination)

        ctxRef.current = ctx
        gainRef.current = gain

        const loadBuffer = async (url: string): Promise<AudioBuffer | null> => {
          try {
            const res = await fetch(url)
            const arr = await res.arrayBuffer()
            const buf = await ctx.decodeAudioData(arr)
            return buf
          } catch (e) {
            console.warn('Failed to load sound:', url, e)
            return null
          }
        }

        const [moveBuf, captureBuf] = await Promise.all([
          loadBuffer('/assets/sound/move.mp3'),
          loadBuffer('/assets/sound/capture.mp3'),
        ])

        if (moveBuf) buffersRef.current.set('move', moveBuf)
        if (captureBuf) buffersRef.current.set('capture', captureBuf)

        if (!canceled) setReady(buffersRef.current.size > 0)
      } catch (error) {
        console.warn('Failed to initialize sound:', error)
        if (!canceled) setReady(false)
      }
    }

    void init()

    return () => {
      canceled = true
      const gain = gainRef.current
      const ctx = ctxRef.current
      try {
        if (gain) gain.disconnect()
      } catch {
        /* noop */
      }
      gainRef.current = null

      try {
        if (ctx) void ctx.close()
      } catch {
        /* noop */
      }
      ctxRef.current = null
      buffersRef.current.clear()
      setReady(false)
      initializedRef.current = false
    }
  }, [])

  const playMoveSound = useCallback(
    (isCapture = false) => {
      if (!settings.soundEnabled) return
      const ctx = ctxRef.current
      const gain = gainRef.current
      if (!ctx || !gain) return

      if (ctx.state !== 'running') {
        void ctx.resume()
      }

      const type: SoundType = isCapture ? 'capture' : 'move'
      const buffer = buffersRef.current.get(type)
      if (!buffer) return

      const nowMs = ctx.currentTime * 1000
      if (
        lastTypeRef.current === type &&
        nowMs - lastPlayedAtMsRef.current < 30
      ) {
        return
      }
      lastTypeRef.current = type
      lastPlayedAtMsRef.current = nowMs

      try {
        const src = ctx.createBufferSource()
        src.buffer = buffer
        src.connect(gain)
        src.start(0)
      } catch (e) {
        console.warn('Failed to play sound:', type, e)
      }
    },
    [settings.soundEnabled],
  )

  const value = useMemo<SoundContextValue>(
    () => ({ playMoveSound, ready }),
    [playMoveSound, ready],
  )

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}
