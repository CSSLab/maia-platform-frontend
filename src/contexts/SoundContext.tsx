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
  // Creates the AudioContext and decodes the sounds, once; resolves when done.
  const startRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    if (initializedRef.current || typeof window === 'undefined') return
    initializedRef.current = true

    let canceled = false

    const AudioCtx: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) {
      console.warn('Web Audio API not supported; sounds disabled')
      return
    }

    // The files are small, and fetched now so that the first move has its
    // sound.
    const files = Promise.all(
      ['/assets/sound/move.mp3', '/assets/sound/capture.mp3'].map((url) =>
        fetch(url)
          .then((res) => res.arrayBuffer())
          .catch((e) => {
            console.warn('Failed to load sound:', url, e)
            return null
          }),
      ),
    )

    // A page's first AudioContext takes 50-80 ms of the main thread (on a
    // desktop) to create, and browsers let it play only after a user
    // gesture (warning if it is created before one). So it is not created
    // while the page loads, but after the first gesture has been answered
    // on screen, or for the first sound.
    let starting: Promise<void> | null = null
    const gestures = ['pointerdown', 'keydown'] as const
    const onGesture = () => {
      removeListeners()
      requestAnimationFrame(() =>
        setTimeout(() => {
          void startRef.current?.()
        }),
      )
    }
    const removeListeners = () => {
      for (const type of gestures)
        window.removeEventListener(type, onGesture, true)
    }

    startRef.current = () => {
      starting ??= (async () => {
        removeListeners()
        try {
          const ctx = new AudioCtx()
          const gain = ctx.createGain()
          gain.connect(ctx.destination)

          ctxRef.current = ctx
          gainRef.current = gain

          const decode = (data: ArrayBuffer | null) =>
            data
              ? ctx.decodeAudioData(data).catch((e) => {
                  console.warn('Failed to decode sound:', e)
                  return null
                })
              : null
          const [moveData, captureData] = await files
          const [moveBuf, captureBuf] = await Promise.all([
            decode(moveData),
            decode(captureData),
          ])

          if (moveBuf) buffersRef.current.set('move', moveBuf)
          if (captureBuf) buffersRef.current.set('capture', captureBuf)

          if (!canceled) setReady(buffersRef.current.size > 0)
        } catch (error) {
          console.warn('Failed to initialize sound:', error)
          if (!canceled) setReady(false)
        }
      })()
      return starting
    }

    for (const type of gestures) window.addEventListener(type, onGesture, true)

    return () => {
      canceled = true
      removeListeners()
      startRef.current = null
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
      const type: SoundType = isCapture ? 'capture' : 'move'
      const ctx = ctxRef.current
      const gain = gainRef.current
      const buffer = buffersRef.current.get(type)
      if (!ctx || !gain || !buffer) {
        // Not started, or still decoding (the gesture that starts the sounds
        // can be the one that plays the first).
        if (startRef.current && !buffer) {
          void startRef.current().then(() => {
            if (buffersRef.current.has(type)) playMoveSound(isCapture)
          })
        }
        return
      }

      if (ctx.state !== 'running') {
        void ctx.resume()
      }

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
