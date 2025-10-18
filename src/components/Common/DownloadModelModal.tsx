import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import {
  trackDownloadModelModalShown,
  trackDownloadModelInitiated,
  trackDownloadModelCompleted,
  trackDownloadModelFailed,
} from 'src/lib/analytics'

interface Props {
  progress: number
  download: () => void
}

export const DownloadModelModal: React.FC<Props> = ({
  progress,
  download,
}: Props) => {
  const [isDownloading, setIsDownloading] = useState(false)
  const downloadStartTime = useRef<number | null>(null)
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
    setIsDownloading(true)
    downloadStartTime.current = Date.now()

    const currentPage =
      typeof window !== 'undefined' ? window.location.pathname : 'unknown'
    trackDownloadModelInitiated(currentPage)

    try {
      await download()

      // Track successful download
      if (downloadStartTime.current) {
        const downloadTime = (Date.now() - downloadStartTime.current) / 1000
        trackDownloadModelCompleted(downloadTime, currentPage)
      }
    } catch (error) {
      // Track failed download
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      trackDownloadModelFailed('download_error', 0, currentPage)
      console.error('Download failed:', errorMessage)
    } finally {
      setIsDownloading(false)
    }
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
            <span className="material-symbols-outlined material-symbols-filled text-3xl text-primary">
              auto_awesome
            </span>
            <h1 className="text-2xl font-bold text-primary md:text-3xl">
              Download Our New Model
            </h1>
          </div>

          <div className="flex flex-col gap-3 text-sm md:text-base">
            <p className="text-primary/80">
              Our newest model, Maia 2, provides richer and more in-depth
              analysis, allowing for:
            </p>
            <ul className="flex list-inside flex-col gap-1.5 pl-2 text-white/80">
              <li>
                ✨ Detailed move evaluations tailored to different rating levels
              </li>
              <li>
                🧠 Insights into how players of various strengths approach the
                game
              </li>
              <li>
                ⚡ Faster, local analysis without needing to send data to a
                server
              </li>
            </ul>
            <p className="text-white/80">
              Maia 2 runs entirely on your device and requires a one-time 90mb
              download.
            </p>
          </div>

          <div className="mt-4 flex w-full flex-col items-end justify-end gap-2 md:mt-6 md:flex-row">
            {progress ? (
              <div className="relative order-2 flex h-8 w-full items-center overflow-hidden rounded-md border border-glass-border bg-glass px-3 md:order-1 md:h-10 md:flex-1">
                <p className="z-10 text-xs text-white/90 md:text-sm">
                  {Math.round(progress)}%
                </p>
                <div
                  className="absolute left-0 top-0 z-0 h-full rounded-l-md bg-human-4 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : null}

            <div className="order-1 flex flex-row gap-2 md:order-2">
              <Link
                href="/"
                className="group flex h-8 cursor-pointer select-none items-center gap-2 rounded border border-glass-border bg-glass px-3 text-sm text-white/90 transition-all duration-200 hover:bg-glass-strong md:h-10 md:px-4"
              >
                <span className="material-symbols-outlined text-base text-secondary group-hover:text-primary md:text-lg">
                  home
                </span>
                <p>Return Home</p>
              </Link>

              <div
                tabIndex={0}
                role="button"
                className={`flex h-8 select-none items-center gap-2 rounded px-3 text-sm text-white transition-all duration-200 md:h-10 md:px-4 ${
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
                  <span className="material-symbols-outlined text-lg md:text-xl">
                    download
                  </span>
                )}
                <p className="font-medium">
                  {isDownloading ? 'Downloading...' : 'Download Maia 2'}{' '}
                  <span className="text-xs text-white/70">(90mb)</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
