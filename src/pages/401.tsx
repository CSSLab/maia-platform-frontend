import Link from 'next/link'
import Head from 'next/head'
import { useContext } from 'react'
import { useRouter } from 'next/router'
import Chessground from '@react-chess/chessground'

import { AuthContext } from 'src/contexts'

export default function Error401Page() {
  const router = useRouter()
  const { user, connectLichess } = useContext(AuthContext)

  if (user?.lichessId) {
    router.push('/')
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-4 py-40 md:flex-row md:px-0">
      <Head>
        <title>Beta Access – Maia Chess</title>
        <meta
          name="description"
          content="Maia Chess is in beta! Sign up to get access"
        />
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
      <div className="flex flex-col items-center gap-2 md:items-start md:gap-5">
        <h2 className="text-2xl font-bold md:text-3xl">
          Sign up for the beta!
        </h2>
        <div className="flex flex-col gap-3">
          <p className="max-w-md text-center text-secondary md:text-left">
            We are currently beta testing the new Maia Chess platform! If you
            part of the beta, please{' '}
            <button onClick={connectLichess} className="underline">
              sign in with Lichess
            </button>
            . Otherwise,{' '}
            <a
              target="_blank"
              href="https://forms.gle/VAUKap4uwMGXJH3N8"
              className="underline"
              rel="noreferrer"
            >
              sign up for the beta
            </a>{' '}
            or{' '}
            <a
              target="_blank"
              href="https://lichess.org/@/maia1"
              className="underline"
              rel="noreferrer"
            >
              play Maia on Lichess
            </a>
            !
          </p>
          <p className="max-w-md text-center text-secondary md:text-left">
            You can also join our{' '}
            <a
              target="_blank"
              rel="noreferrer"
              className="underline"
              href="https://discord.gg/Az93GqEAs7"
            >
              Discord
            </a>{' '}
            and stay tuned for our full release
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/">
            <button className="rounded bg-engine-4 px-4 py-2 font-medium transition duration-200 hover:bg-engine-3 md:px-6">
              Go home
            </button>
          </Link>
          <a
            target="_blank"
            href="https://forms.gle/VAUKap4uwMGXJH3N8"
            className="rounded bg-engine-4 px-4 py-2 font-medium transition duration-200 hover:bg-engine-3 md:px-6"
            rel="noreferrer"
          >
            Sign up for the BETA
          </a>
        </div>
      </div>
    </div>
  )
}
