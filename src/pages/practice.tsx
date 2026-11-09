import Head from 'next/head'
import Link from 'next/link'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { AnimatePresence } from 'framer-motion'
import { useMemo, useState } from 'react'

import { StockfishEngineContextProvider } from 'src/contexts/StockfishEngineContext'
import { MaiaEngineContextProvider } from 'src/contexts/MaiaEngineContext'
import { DownloadModelModal } from 'src/components/Common/DownloadModelModal'
import { MAIA_DOWNLOAD_MB } from 'src/lib/engine/maiaDownloadPrompt'
import { PracticeSession } from 'src/components/Practice/PracticeSession'
import { PracticeSource, usePracticeDay } from 'src/hooks/usePracticeDay'

const GAME_TYPES = ['play', 'hand', 'brain', 'lichess'] as const

const readSource = (
  query: Record<string, string | string[] | undefined>,
): PracticeSource | null => {
  const { game, type, color } = query
  if (typeof game !== 'string' || !/^[\w-]{1,64}$/.test(game)) return null
  if (!GAME_TYPES.includes(type as (typeof GAME_TYPES)[number])) return null
  if (color !== 'white' && color !== 'black') return null
  return {
    gameId: game,
    gameType: type as PracticeSource['gameType'],
    color,
  }
}

const PracticePage: NextPage = () => {
  const router = useRouter()
  const source = useMemo(
    () => (router.isReady ? readSource(router.query) : undefined),
    [router.isReady, router.query],
  )
  const { state, maia } = usePracticeDay(source)
  const [askingForMaia, setAskingForMaia] = useState(false)

  return (
    <>
      <Head>
        <title>Practice your mistakes – Maia Chess</title>
        <meta
          name="description"
          content="Three positions a day from your own games, where you went wrong: find a better move."
        />
      </Head>
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 px-4 py-6">
        <div>
          <h1 className="text-xl font-bold text-white/95">
            Practice your mistakes
          </h1>
          <p className="text-sm text-white/60">
            Three positions a day from your games: mistakes players at your
            level can fix.
          </p>
        </div>
        {state.status === 'preparing' && (
          <div className="flex flex-col gap-3 py-6" aria-busy="true">
            <p className="text-sm text-white/60">
              {state.progress
                ? 'Finding where you went wrong…'
                : 'Getting your positions…'}
            </p>
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full bg-human-2 transition-all duration-300 ${state.progress ? '' : 'animate-pulse'}`}
                style={{
                  width: state.progress?.total
                    ? `${(100 * state.progress.done) / state.progress.total}%`
                    : '15%',
                }}
              />
            </div>
          </div>
        )}
        {state.status === 'error' && (
          <p className="py-6 text-sm text-white/55">
            Your positions couldn&apos;t be loaded. Try again later.
          </p>
        )}
        {state.status === 'ready' &&
          state.source &&
          state.source.moments.length === 0 && (
            <p className="text-sm text-white/55">
              No mistakes in that game: none of your moves lost 5% or more of
              your winning chances.
            </p>
          )}
        {state.status === 'ready' && state.day.positions.length === 0 && (
          <div className="flex flex-col items-start gap-3 py-6 text-sm text-white/55">
            <p>
              {state.source
                ? 'Nothing else to practise today.'
                : 'Nothing to practise yet. Play a game, and the moments you went wrong will be here.'}
            </p>
            <Link
              href="/play"
              className="rounded-full bg-human-4 px-4 py-1.5 font-medium text-white transition-colors duration-200 hover:bg-human-3"
            >
              Play Maia
            </Link>
          </div>
        )}
        {state.status === 'ready' && state.day.positions.length > 0 && (
          <PracticeSession day={state.day} />
        )}
        {state.status === 'ready' &&
          state.withoutMaia &&
          maia.status === 'no-cache' && (
            <p className="text-xs text-white/40">
              Without Maia, positions come from all your mistakes.{' '}
              <button
                type="button"
                onClick={() => setAskingForMaia(true)}
                className="underline hover:text-white/80"
              >
                Download Maia ({MAIA_DOWNLOAD_MB} MB)
              </button>{' '}
              to keep to the ones players at your level can fix.
            </p>
          )}
        <AnimatePresence>
          {askingForMaia && maia.status !== 'ready' && (
            <DownloadModelModal
              maia={maia.maia}
              progress={maia.progress}
              download={maia.downloadModel}
              downloading={maia.status === 'downloading'}
              onNotNow={() => setAskingForMaia(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

const Page = PracticePage as NextPage & {
  providers?: React.FC<{ children: React.ReactNode }>[]
}
// Maia only loads a model already in this browser: nothing is downloaded
// without the visitor's yes in the download dialog.
const QuietMaia: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MaiaEngineContextProvider quiet>{children}</MaiaEngineContextProvider>
)
Page.providers = [StockfishEngineContextProvider, QuietMaia]

export default Page
