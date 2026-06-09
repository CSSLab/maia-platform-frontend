import Head from 'next/head'
import dynamic from 'next/dynamic'
import type { NextPage } from 'next'
import React, { useCallback, useContext, useEffect, useRef } from 'react'

import { ModalContext } from 'src/contexts/ModalContext'
import { AboutMaia } from 'src/components/Home/AboutMaia'
import { HomeHero } from 'src/components/Home/HomeHero'
import { PageNavigation } from 'src/components/Home/PageNavigation'
import { GameCarousel } from 'src/components/Home/GameCarousel'

const HomeSectionFallback = ({ id }: { id: string }) => (
  <section
    id={id}
    className="relative min-h-[60vh] w-full bg-transparent"
    aria-busy="true"
  />
)

const PlaySection = dynamic(
  () =>
    import('src/components/Home/Sections/PlaySection').then(
      (mod) => mod.PlaySection,
    ),
  {
    ssr: false,
    loading: () => <HomeSectionFallback id="play-section" />,
  },
)

const AnalysisSection = dynamic(
  () =>
    import('src/components/Home/Sections/AnalysisSection').then(
      (mod) => mod.AnalysisSection,
    ),
  {
    ssr: false,
    loading: () => <HomeSectionFallback id="analysis-section" />,
  },
)

const TrainSection = dynamic(
  () =>
    import('src/components/Home/Sections/TrainSection').then(
      (mod) => mod.TrainSection,
    ),
  {
    ssr: false,
    loading: () => <HomeSectionFallback id="train-section" />,
  },
)

const AdditionalFeaturesSection = dynamic(
  () =>
    import('src/components/Home/Sections/AdditionalFeaturesSection').then(
      (mod) => mod.AdditionalFeaturesSection,
    ),
  {
    ssr: false,
    loading: () => <HomeSectionFallback id="more-features" />,
  },
)

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
      <GameCarousel />
      <PageNavigation />
      <div ref={featuresRef}>
        {/* Play Section with subtle radial overlays */}
        <div className="relative bg-transparent">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 90% 80% at 0% 20%, rgba(239, 68, 68, 0.08) 0%, transparent 72%), radial-gradient(ellipse 70% 60% at 100% 60%, rgba(239, 68, 68, 0.06) 0%, transparent 75%)',
            }}
          />
          <PlaySection id="play-section" />
        </div>

        {/* Analysis Section with mirrored edge glows */}
        <div className="relative bg-transparent">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 95% 85% at 100% 15%, rgba(239, 68, 68, 0.08) 0%, transparent 72%), radial-gradient(ellipse 80% 70% at 0% 70%, rgba(239, 68, 68, 0.06) 0%, transparent 75%)',
            }}
          />
          <AnalysisSection id="analysis-section" />
        </div>

        {/* Train Section with lower-edge emphasis */}
        <div className="relative bg-transparent">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 100% 85% at 0% 90%, rgba(239, 68, 68, 0.07) 0%, transparent 75%), radial-gradient(ellipse 75% 65% at 100% 40%, rgba(239, 68, 68, 0.05) 0%, transparent 75%)',
            }}
          />
          <TrainSection id="train-section" />
        </div>

        {/* Additional Features with diagonal accents */}
        <div className="relative bg-transparent">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 90% 80% at 100% 85%, rgba(239, 68, 68, 0.08) 0%, transparent 72%), radial-gradient(ellipse 80% 70% at 0% 10%, rgba(239, 68, 68, 0.06) 0%, transparent 75%)',
            }}
          />
          <AdditionalFeaturesSection id="more-features" />
        </div>

        <AboutMaia />
      </div>
    </>
  )
}

export default Home
