import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import {
  DownloadModelModal,
  MaiaDownloadProgress,
} from 'src/components/Common/DownloadModelModal'
import {
  downloadsWithoutAsking,
  maiaPromptVariant,
  startMaiaDownload,
} from 'src/lib/engine/maiaDownloadPrompt'
import { trackDownloadModelDismissed } from 'src/lib/analytics'
import { MaiaEngine } from 'src/types'

interface Props {
  engine: Pick<MaiaEngine, 'maia' | 'status' | 'progress' | 'downloadModel'>
  /** False until the page has a use for Maia, as during a puzzle. */
  wanted?: boolean
}

const DISMISSED_KEY = 'maia.downloadOfferDismissed'

const wasDismissed = () => {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Asks for the Maia model, or fetches it (see maiaDownloadPrompt). One group
 * gets the prompt that blocks the page. In the other, desktops download without
 * asking, and phones get the same prompt but can say "Continue without Maia"; the page stays
 * usable during the download, with a small card showing how it's going.
 */
export const MaiaDownloadPrompt: React.FC<Props> = ({
  engine,
  wanted = true,
}: Props) => {
  const { maia, status, progress, downloadModel } = engine
  const needed = status === 'no-cache' || status === 'downloading'
  const [dismissed, setDismissed] = useState(false)
  const autoStarted = useRef(false)
  const downloadSeen = useRef(false)
  if (status === 'downloading') downloadSeen.current = true

  const usesWall = needed && maiaPromptVariant() === 'wall'
  const asks = status === 'no-cache' && wanted && !usesWall
  const auto = asks && downloadsWithoutAsking()

  useEffect(() => {
    if (auto && !autoStarted.current) {
      autoStarted.current = true
      startMaiaDownload(downloadModel, 'auto')
    }
  }, [auto, downloadModel])

  const dismiss = () => {
    setDismissed(true)
    trackDownloadModelDismissed(window.location.pathname)
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // It comes back on the next page.
    }
  }

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

  if (asks && !auto && !dismissed && !wasDismissed()) {
    return (
      <AnimatePresence>
        <DownloadModelModal
          maia={maia}
          progress={progress}
          download={downloadModel}
          onNotNow={dismiss}
        />
      </AnimatePresence>
    )
  }

  const downloading = status === 'downloading'
  const failed = status === 'error' && downloadSeen.current

  return (
    <AnimatePresence>
      {downloading || failed ? (
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
