import Head from 'next/head'
import Link from 'next/link'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useMemo } from 'react'

import { StockfishEngineContextProvider } from 'src/contexts/StockfishEngineContext'
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
  const state = usePracticeDay(source)

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
            Three positions a day from your games, where you went wrong.
          </p>
        </div>
        {state.status === 'preparing' && (
          <div
            className="flex flex-col gap-3 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur-md"
            aria-busy="true"
          >
            <p className="text-sm text-white/80">
              {state.progress
                ? 'Finding where you went wrong…'
                : 'Getting your positions…'}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded bg-white/10">
              <div
                className={`h-full rounded bg-human-4 transition-all duration-300 ${state.progress ? '' : 'animate-pulse'}`}
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
          <p className="rounded-lg border border-glass-border bg-glass p-4 text-sm text-white/60">
            Your positions couldn&apos;t be loaded. Try again later.
          </p>
        )}
        {state.status === 'ready' &&
          state.source &&
          state.source.moments.length === 0 && (
            <p className="rounded-lg border border-glass-border bg-glass p-4 text-sm text-white/70">
              No mistakes in that game: none of your moves lost 5% or more of
              your winning chances.
            </p>
          )}
        {state.status === 'ready' && state.day.positions.length === 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-glass-border bg-glass p-4 text-sm text-white/60">
            <p>
              {state.source
                ? 'Nothing else to practise today.'
                : 'Nothing to practise yet. Play a game, and the moments you went wrong will be here.'}
            </p>
            <Link href="/play" className="text-white/80 underline">
              Play Maia
            </Link>
          </div>
        )}
        {state.status === 'ready' && state.day.positions.length > 0 && (
          <PracticeSession day={state.day} />
        )}
      </div>
    </>
  )
}

const Page = PracticePage as NextPage & {
  providers?: React.FC<{ children: React.ReactNode }>[]
}
Page.providers = [StockfishEngineContextProvider]

export default Page
