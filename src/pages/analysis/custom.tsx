import Head from 'next/head'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'

import { storeCustomGame } from 'src/api'
import { Loading } from 'src/components'
import { AuthenticatedWrapper } from 'src/components/Common/AuthenticatedWrapper'
import { isValidFen, normalizeFen } from 'src/lib/positionLinks'

const CustomAnalysisLinkPage: NextPage = () => {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const queryPayload = useMemo(() => {
    const fen =
      typeof router.query.fen === 'string' ? normalizeFen(router.query.fen) : ''
    const pgn = typeof router.query.pgn === 'string' ? router.query.pgn : ''
    const name =
      typeof router.query.name === 'string' ? router.query.name : undefined

    return { fen, pgn, name }
  }, [router.query.fen, router.query.name, router.query.pgn])

  useEffect(() => {
    if (!router.isReady) return

    let cancelled = false

    const run = async () => {
      const hasPgn = queryPayload.pgn.trim().length > 0
      const hasFen = queryPayload.fen.length > 0

      if (!hasPgn && !hasFen) {
        setError('Add a PGN or FEN to open a linked analysis position.')
        return
      }

      if (!hasPgn && !isValidFen(queryPayload.fen)) {
        setError('This linked position contains an invalid FEN.')
        return
      }

      try {
        const { game_id } = await storeCustomGame({
          name: queryPayload.name,
          pgn: hasPgn ? queryPayload.pgn : undefined,
          fen: hasPgn ? undefined : queryPayload.fen,
        })

        if (cancelled) return

        await router.replace(`/analysis/${game_id}/custom`)
      } catch (caughtError) {
        if (cancelled) return

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : 'Failed to open the linked analysis position.'
        setError(message)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [queryPayload, router, router.isReady])

  return (
    <>
      <Head>
        <title>Opening Linked Analysis – Maia Chess</title>
        <meta
          name="description"
          content="Open a pre-filled Maia analysis position from a direct link."
        />
      </Head>
      <Loading isLoading={!error}>
        <div className="flex min-h-[50vh] items-center justify-center px-6">
          <div className="max-w-md rounded-2xl border border-glass-border bg-glass px-6 py-5 text-center backdrop-blur-md">
            <p className="text-lg font-semibold text-primary">
              {error
                ? 'Linked analysis could not load'
                : 'Opening linked analysis'}
            </p>
            <p className="mt-2 text-sm text-secondary">
              {error
                ? error
                : 'Creating a custom analysis view for this position.'}
            </p>
          </div>
        </div>
      </Loading>
    </>
  )
}

export default function AuthenticatedCustomAnalysisLinkPage() {
  return (
    <AuthenticatedWrapper>
      <CustomAnalysisLinkPage />
    </AuthenticatedWrapper>
  )
}
