import Head from 'next/head'
import type { NextPage } from 'next'
import React, { useCallback, useContext, useEffect, useRef } from 'react'

import { ModalContext } from 'src/contexts'
import {
  HomeHero,
  AboutMaia,
  PlaySection,
  AnalysisSection,
  TrainSection,
  AdditionalFeaturesSection,
  PageNavigation,
} from 'src/components'
import { LiveChessShowcase } from 'src/components/Home/LiveChessShowcase'

const Home: NextPage = () => {
  const { setPlaySetupModalProps } = useContext(ModalContext)

  // Close play dialog if page closed
  useEffect(
    () => () => setPlaySetupModalProps(undefined),
    [setPlaySetupModalProps],
  )

  const featuresRef = useRef<HTMLDivElement>(null)

  const scrollHandler = useCallback(() => {
    if (featuresRef.current) {
      featuresRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [featuresRef])

  return (
    <>
      <Head>
        <title>Maia Chess</title>
        <meta
          name="description"
          content="Maia is a neural network chess model that captures human style. Go beyond perfect engine lines by analyzing games with real-world context, training with curated puzzles, and seeing what players at higher rating levels actually do in every position."
        />
      </Head>
      <HomeHero scrollHandler={scrollHandler} />
      <LiveChessShowcase />
      <PageNavigation />
      <div ref={featuresRef}>
        <div className="bg-background-1">
          <PlaySection id="play-section" />
        </div>
        <div className="bg-background-2">
          <AnalysisSection id="analysis-section" />
        </div>
        <div className="bg-background-1">
          <TrainSection id="train-section" />
        </div>
        <div className="bg-background-2">
          <AdditionalFeaturesSection id="more-features" />
        </div>
        <AboutMaia />
      </div>
    </>
  )
}

export default Home
