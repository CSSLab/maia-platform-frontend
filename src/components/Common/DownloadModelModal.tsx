import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { trackDownloadModelModalShown } from 'src/lib/analytics'
import {
  MAIA_DOWNLOAD_MB,
  downloadTimeLeft,
  startMaiaDownload,
} from 'src/lib/engine/maiaDownloadPrompt'
import type Maia from 'src/lib/engine/maia'

/** Bar with the size done and the time left, while the model downloads. */
export const MaiaDownloadProgress: React.FC<{ maia?: Maia }> = ({ maia }) => {
  const percent = useSyncExternalStore(
    (listener) => maia?.onDownloadProgress(listener) ?? (() => undefined),
    () => maia?.downloadPercent ?? 0,
    () => 0,
  )
  const elapsed = maia ? (Date.now() - maia.downloadStartedAt) / 1000 : 0
  const timeLeft = downloadTimeLeft(percent, elapsed)
  return (
    <div className="relative flex h-8 w-full items-center overflow-hidden rounded-md border border-glass-border bg-glass px-3 md:h-10">
      <p className="z-10 text-xs text-white/90 md:text-sm">
        {percent > 0
          ? `${Math.round((MAIA_DOWNLOAD_MB * percent) / 100)} of ${MAIA_DOWNLOAD_MB}MB${timeLeft ? `, ${timeLeft}` : ''}`
          : 'Starting download...'}
      </p>
      <div
        className={`absolute left-0 top-0 z-0 h-full rounded-l-md bg-human-4 transition-all duration-500 ease-out ${
          percent === 0 ? 'animate-pulse' : ''
        }`}
        style={{ width: `${percent > 0 ? percent : 12}%` }}
      />
    </div>
  )
}

interface Props {
  maia?: Maia
  progress: number
  download: () => Promise<boolean>
  /** A download that started before this prompt appeared. */
  downloading?: boolean
  /** Offers to carry on without Maia, rather than only to leave. */
  onNotNow?: () => void
}

export const DownloadModelModal: React.FC<Props> = ({
  maia,
  progress,
  download,
  downloading = false,
  onNotNow,
}: Props) => {
  const [startedDownload, setStartedDownload] = useState(false)
  const isDownloading = startedDownload || downloading
  const hasTrackedModalShown = useRef(false)

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Track modal shown event once
    if (!hasTrackedModalShown.current) {
      const currentPage =
        typeof window !== 'undefined' ? window.location.pathname : 'unknown'
      trackDownloadModelModalShown('page_load', currentPage)
      hasTrackedModalShown.current = true
    }

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  const handleDownload = async () => {
    if (isDownloading || progress >= 100) return
    setStartedDownload(true)
    await startMaiaDownload(download, onNotNow ? 'tap' : 'wall')
    setStartedDownload(false)
  }
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 md:px-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      data-testid="download-modal"
      onTouchMove={(e) => e.preventDefault()}
    >
      <div className="pointer-events-auto absolute inset-0 bg-backdrop/90" />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 75% 60% at center top, rgba(239, 68, 68, 0.08) 0%, transparent 60%)',
        }}
      />
      <motion.div
        className="relative z-10 w-full md:max-w-[min(750px,50vw)]"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 10, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="group relative flex w-full flex-col gap-5 overflow-hidden rounded-lg border border-glass-border bg-glass p-5 text-left backdrop-blur-md transition-all duration-300 md:p-8">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined material-symbols-filled shrink-0 text-3xl text-primary">
              auto_awesome
            </span>
            <h1 className="text-lg font-bold text-primary md:text-2xl">
              Download the new <span className="whitespace-nowrap">Maia-3</span>{' '}
              (one-time {MAIA_DOWNLOAD_MB}MB download)
            </h1>
          </div>

          <p className="text-sm text-white/80 md:text-base">
            Our best model yet: the most human-like chess AI, now running on
            your device, with human moves at every rating in under half a
            second.
          </p>

          <div className="mt-4 flex w-full flex-col items-end justify-end gap-2 md:mt-6 md:flex-row">
            {isDownloading || progress > 0 ? (
              <div className="order-2 w-full md:order-1 md:flex-1">
                <MaiaDownloadProgress maia={maia} />
              </div>
            ) : null}

            <div className="order-1 flex flex-row flex-wrap-reverse justify-end gap-2 md:order-2">
              {onNotNow ? (
                <button
                  type="button"
                  onClick={onNotNow}
                  className="flex h-8 cursor-pointer select-none items-center whitespace-nowrap rounded border border-glass-border bg-glass px-3 text-sm text-white/90 transition-all duration-200 hover:bg-glass-strong md:h-10 md:px-4"
                >
                  Continue without Maia
                </button>
              ) : (
                <Link
                  href="/"
                  className="group flex h-8 cursor-pointer select-none items-center gap-2 rounded border border-glass-border bg-glass px-3 text-sm text-white/90 transition-all duration-200 hover:bg-glass-strong md:h-10 md:px-4"
                >
                  <span className="material-symbols-outlined text-base text-secondary group-hover:text-primary md:text-lg">
                    home
                  </span>
                  <p>Return Home</p>
                </Link>
              )}

              <div
                tabIndex={0}
                role="button"
                className={`flex h-8 select-none items-center gap-2 whitespace-nowrap rounded px-3 text-sm text-white transition-all duration-200 md:h-10 md:px-4 ${
                  isDownloading || progress >= 100
                    ? 'cursor-not-allowed border border-human-4/30 bg-human-4/50'
                    : 'cursor-pointer border border-glass-border bg-human-4 hover:bg-human-3'
                }`}
                onClick={handleDownload}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleDownload()
                  }
                }}
              >
                {isDownloading ? (
                  <span className="material-symbols-outlined animate-spin text-lg md:text-xl">
                    progress_activity
                  </span>
                ) : (
                  <span className="hidden md:inline-flex">
                    <span className="material-symbols-outlined text-xl">
                      download
                    </span>
                  </span>
                )}
                <p className="font-medium">
                  {isDownloading
                    ? 'Downloading...'
                    : `Download Maia-3 (${MAIA_DOWNLOAD_MB}MB)`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
