import Head from 'next/head'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'

import {
  PlaySetupModal,
  PlaySetupModalProps,
} from 'src/components/Common/PlaySetupModal'

const MARK_QUERY = `if (location.search) document.documentElement.classList.add('play-has-query')`

const PlayPage: NextPage = () => {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  const {
    fen,
    returnTo,
    challengeId,
    forcedColor,
    modalTitle,
    modalSubtitle,
    maiaVersion,
    timeControl,
  } = router.query

  const setupProps: PlaySetupModalProps = useMemo(
    () => ({
      playType: 'againstMaia',
      startFen: typeof fen == 'string' ? fen : undefined,
      maiaVersion: typeof maiaVersion == 'string' ? maiaVersion : undefined,
      timeControl:
        typeof timeControl == 'string'
          ? (timeControl as PlaySetupModalProps['timeControl'])
          : undefined,
      returnTo: typeof returnTo == 'string' ? returnTo : undefined,
      challengeId: typeof challengeId == 'string' ? challengeId : undefined,
      forcedPlayerColor:
        forcedColor === 'white' || forcedColor === 'black'
          ? forcedColor
          : undefined,
      modalTitle: typeof modalTitle == 'string' ? modalTitle : undefined,
      modalSubtitle:
        typeof modalSubtitle == 'string' ? modalSubtitle : undefined,
    }),
    [
      fen,
      challengeId,
      forcedColor,
      maiaVersion,
      modalSubtitle,
      modalTitle,
      returnTo,
      timeControl,
    ],
  )

  return (
    <>
      <Head>
        <title>Play – Maia Chess</title>
        <meta
          name="description"
          content="Play chess against Maia, the human-like chess AI, at the rating level you choose."
        />
      </Head>
      {/* The setup dialog is the page, so it is rendered here, in the
          server's HTML too, rather than opened through ModalContext once the
          app has loaded. Its settings come from the URL, which a static page
          only reads once the router is ready: the key starts it again then
          if the URL has any, and until then a URL with a query (a challenge,
          a position to continue from) hides the server's default dialog. */}
      <script dangerouslySetInnerHTML={{ __html: MARK_QUERY }} />
      <div
        className={router.isReady ? undefined : '[.play-has-query_&]:invisible'}
      >
        {open && (
          <PlaySetupModal
            key={JSON.stringify(setupProps)}
            {...setupProps}
            animateIn={false}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    </>
  )
}

export default PlayPage
