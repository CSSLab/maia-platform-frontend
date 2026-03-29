import Head from 'next/head'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'

import { ModalContext } from 'src/contexts'

const PlayPage: NextPage = () => {
  const router = useRouter()
  const { setPlaySetupModalProps } = useContext(ModalContext)
  const [launchedModal, setLaunchedModal] = useState<boolean>(false)

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

  useEffect(() => {
    if (!router.isReady) {
      return
    }

    if (!launchedModal) {
      setPlaySetupModalProps({
        playType: 'againstMaia',
        startFen: typeof fen == 'string' ? fen : undefined,
        maiaVersion: typeof maiaVersion == 'string' ? maiaVersion : undefined,
        timeControl: typeof timeControl == 'string' ? timeControl : undefined,
        returnTo: typeof returnTo == 'string' ? returnTo : undefined,
        challengeId: typeof challengeId == 'string' ? challengeId : undefined,
        forcedPlayerColor:
          forcedColor === 'white' || forcedColor === 'black'
            ? forcedColor
            : undefined,
        modalTitle: typeof modalTitle == 'string' ? modalTitle : undefined,
        modalSubtitle:
          typeof modalSubtitle == 'string' ? modalSubtitle : undefined,
      })
      setLaunchedModal(true)
    }
  }, [
    router.isReady,
    fen,
    challengeId,
    forcedColor,
    launchedModal,
    maiaVersion,
    modalSubtitle,
    modalTitle,
    returnTo,
    setPlaySetupModalProps,
    timeControl,
  ])

  useEffect(() => {
    const handleStart = (url: string) => {
      if (url !== router.asPath) {
        setPlaySetupModalProps(undefined)
      }
    }
    router.events.on('routeChangeStart', handleStart)

    return () => {
      router.events.off('routeChangeStart', handleStart)
    }
  })

  return (
    <>
      <Head>
        <title>Maia Chess - Play</title>
        <meta name="description" content="Play Against Maia" />
      </Head>
    </>
  )
}

export default PlayPage
