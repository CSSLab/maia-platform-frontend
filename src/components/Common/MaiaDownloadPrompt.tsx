import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import {
  DownloadModelModal,
  MaiaDownloadProgress,
} from 'src/components/Common/DownloadModelModal'
import {
  downloadsWithoutAsking,
  startMaiaDownload,
} from 'src/lib/engine/maiaDownloadPrompt'
import { MAIA_DOWNLOAD_MB } from 'src/constants/common'
import { MaiaEngine } from 'src/types'

interface Props {
  engine: Pick<
    MaiaEngine,
    'maia' | 'status' | 'progress' | 'downloadModel' | 'downloadFailed'
  >
  /** False until the page has a use for Maia, as during a puzzle. */
  wanted?: boolean
  /**
   * False for a page that is used without Maia, such as puzzles: a phone is
   * asked with the card, once Maia is wanted, rather than with the prompt
   * that blocks the page. With that prompt, phones completed a puzzle in 38%
   * of visits, against 71% for those who could continue without Maia (Nov
   * 2026).
   */
  blocking?: boolean
}

/**
 * Asks for the Maia model, or fetches it (see maiaDownloadPrompt). Desktops
 * download without asking: in the two-day comparison 93% got Maia that way,
 * against 64% with the prompt that blocks the page. Phones get the prompt that
 * blocks the page: in a week-long comparison (Nov 2026) it beat a prompt with
 * "Continue without Maia" on phones, with more of them getting Maia (61%
 * against 51%), playing (25% against 20%) and analysing (55% against 48%).
 * Once a download has started, a small card shows how it's going. A page used
 * without Maia (`blocking` false) asks with that card instead.
 */
export const MaiaDownloadPrompt: React.FC<Props> = ({
  engine,
  wanted = true,
  blocking = true,
}: Props) => {
  const { maia, status, progress, downloadModel, downloadFailed } = engine
  const needed = status === 'no-cache' || status === 'downloading'
  const autoStarted = useRef(false)

  const asks = needed && !downloadsWithoutAsking()
  const usesWall = asks && blocking
  const auto = status === 'no-cache' && wanted && !asks
  // Asked with the card instead (see `blocking`).
  const offered = status === 'no-cache' && asks && !blocking && wanted

  useEffect(() => {
    if (auto && !autoStarted.current) {
      autoStarted.current = true
      startMaiaDownload(downloadModel, 'auto')
    }
  }, [auto, downloadModel])

  if (usesWall) {
    return (
      <AnimatePresence>
        <DownloadModelModal
          maia={maia}
          progress={progress}
          download={downloadModel}
          downloading={status === 'downloading'}
        />
      </AnimatePresence>
    )
  }

  const downloading = status === 'downloading'
  // The engine remembers a failed download, so the card offers another try
  // wherever the download started: in the prompt that blocked the page, which
  // is gone once it fails, or on another screen of the same page.
  const failed = status === 'error' && downloadFailed

  return (
    <AnimatePresence>
      {downloading || failed || offered ? (
        <motion.div
          className="fixed inset-x-3 bottom-3 z-[60] md:inset-x-auto md:right-4 md:w-[22rem]"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          transition={{ duration: 0.2 }}
          data-testid="maia-download-card"
          role="status"
        >
          <div className="flex flex-col gap-2 rounded-lg border border-glass-border bg-backdrop/95 p-3 text-sm shadow-lg backdrop-blur-md">
            {downloading ? (
              <>
                <p className="font-medium text-white/90">Downloading Maia-3</p>
                <MaiaDownloadProgress maia={maia} />
              </>
            ) : offered ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-white/90">Maia-3 for this review</p>
                <button
                  type="button"
                  onClick={() => startMaiaDownload(downloadModel, 'offer')}
                  className="h-8 shrink-0 rounded border border-glass-border bg-human-4 px-3 font-medium text-white"
                >
                  Download ({MAIA_DOWNLOAD_MB} MB)
                </button>
              </div>
            ) : (
              <>
                <p className="text-white/90">
                  Maia-3 didn&apos;t finish downloading.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => startMaiaDownload(downloadModel, 'tap')}
                    className="h-8 rounded border border-glass-border bg-human-4 px-3 font-medium text-white"
                  >
                    Try again
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
