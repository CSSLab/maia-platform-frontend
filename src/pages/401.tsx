import Link from 'next/link'
import Head from 'next/head'
import { useContext } from 'react'
import { useRouter } from 'next/router'
import Chessground from '@react-chess/chessground'

import { AuthContext } from 'src/contexts'

// Pages come here when a request to the Maia server fails, whatever the
// reason, so this page offers another try rather than a sign-in wall.
export default function Error401Page() {
  const router = useRouter()
  const { user, connectLichess } = useContext(AuthContext)

  // Going back to the page that failed makes it request its data again. If
  // the tab loaded /401 itself (a direct visit or a reload), the page before
  // it may be another site, so this goes home instead.
  const tryAgain = () => {
    const [load] = performance.getEntriesByType('navigation')
    if (load && new URL(load.name).pathname === router.pathname) {
      router.push('/')
    } else {
      router.back()
    }
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-4 py-24 md:flex-row md:py-40">
      <Head>
        <title>Something Went Wrong – Maia Chess</title>
        <meta
          name="description"
          content="Maia Chess couldn't load this. Please try again."
        />
        <meta name="robots" content="noindex" />
      </Head>
      <div
        style={{
          width: 'min(40vw, 40vh)',
          height: 'min(40vw, 40vh)',
        }}
      >
        <Chessground
          contained
          config={{
            fen: 'rn1qkb1r/ppp1pBpp/5n2/4N3/8/2N5/PPPP1PPP/R1BbK2R b KQkq - 0 7',
            check: 'black',
            viewOnly: true,
          }}
        />
      </div>
      <div className="flex flex-col items-center gap-4 text-center md:items-start md:text-left">
        <h1 className="text-2xl font-bold md:text-3xl">Something went wrong</h1>
        <p className="max-w-md text-secondary">
          We couldn&apos;t load this from the Maia server. Please try again in a
          moment.
        </p>
        <p className="max-w-md text-secondary">
          If it keeps happening,{' '}
          {!user?.lichessId && (
            <>
              <button
                onClick={() => connectLichess('error_page')}
                className="underline"
              >
                sign in with Lichess
              </button>{' '}
              or{' '}
            </>
          )}
          let us know on{' '}
          <a
            target="_blank"
            rel="noreferrer"
            className="underline"
            href="https://discord.gg/Az93GqEAs7"
          >
            Discord
          </a>
          .
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={tryAgain}
            className="rounded bg-human-4 px-5 py-2 font-medium text-white transition duration-200 hover:bg-human-4/80"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded border border-glass-border bg-glass px-5 py-2 font-medium transition duration-200 hover:bg-glass-stronger"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
