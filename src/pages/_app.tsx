import Head from 'next/head'
import { Toaster } from 'react-hot-toast'
import Script from 'next/script'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import posthog from 'posthog-js'
import { Analytics } from '@vercel/analytics/react'
import { PostHogProvider } from 'posthog-js/react'
import { SoundProvider } from 'src/contexts/SoundContext'

import {
  AuthContextProvider,
  ModalContextProvider,
  WindowSizeContextProvider,
  AnalysisListContextProvider,
  MaiaEngineContextProvider,
  StockfishEngineContextProvider,
  SettingsProvider,
  TourProvider as TourContextProvider,
} from 'src/contexts'
import 'src/styles/tailwind.css'
import 'src/styles/themes.css'
import 'react-tooltip/dist/react-tooltip.css'
import 'node_modules/chessground/assets/chessground.base.css'
import 'node_modules/chessground/assets/chessground.brown.css'
import 'node_modules/chessground/assets/chessground.cburnett.css'
import {
  Footer,
  Compose,
  ErrorBoundary,
  Header,
  FeedbackButton,
} from 'src/components'

const openSansClassName = 'font-sans'

function MaiaPlatform({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const isAnalysisPage = router.pathname.startsWith('/analysis')
  const isPageWithAnalysis = [
    '/analysis',
    '/openings',
    '/puzzles',
    '/settings',
    '/broadcast',
  ].some((path) => router.pathname.includes(path))

  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
      api_host: '/ingest',
      ui_host: 'https://us.posthog.com',
      defaults: '2025-05-24',
      capture_exceptions: true,
      debug: false,
    })
  }, [])

  return (
    <PostHogProvider client={posthog}>
      <TourContextProvider>
        <Compose
          components={[
            SettingsProvider,
            SoundProvider,
            WindowSizeContextProvider,
            AuthContextProvider,
            ErrorBoundary,
            ModalContextProvider,
            ...(isPageWithAnalysis
              ? [MaiaEngineContextProvider, StockfishEngineContextProvider]
              : []),
            ...(isAnalysisPage ? [AnalysisListContextProvider] : []),
          ]}
        >
          <Head>
            <link rel="icon" type="image/png" href="/favicon.png" />
            <link
              rel="stylesheet"
              href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
            />

            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta
              name="apple-mobile-web-app-status-bar-style"
              content="default"
            />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />

            <meta name="apple-mobile-web-app-title" content="Maia Chess" />
            <link rel="apple-touch-icon" href="/maia-ios-icon.png" />

            {/* Open Graph meta tags for social media embeds */}
            <meta property="og:image" content="/embed.png" />
            <meta property="og:image:alt" content="Maia Chess" />
            <meta property="og:image:type" content="image/png" />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:site_name" content="Maia Chess" />

            {/* Twitter Card meta tags */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:image" content="/embed.png" />
            <meta name="twitter:image:alt" content="Maia Chess" />
          </Head>

          <div className={`${openSansClassName} app-container`}>
            <Header />
            <div className="content-container">
              <div
                className="pointer-events-none fixed inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse 120% 80% at center top, rgba(239, 68, 68, 0.08) 0%, transparent 75%)',
                }}
              />
              <Component {...pageProps} />
            </div>
            <Footer />
            <FeedbackButton />
          </div>
          <Toaster position="bottom-right" />
          <Analytics />
          <Script async src="/analytics.js?id=G-SNP84LXLKY" />
          <Script id="analytics">
            {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-SNP84LXLKY');
          `}
          </Script>
        </Compose>
      </TourContextProvider>
    </PostHogProvider>
  )
}

export default MaiaPlatform
