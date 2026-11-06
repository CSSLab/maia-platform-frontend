import Head from 'next/head'
import { Toaster } from 'react-hot-toast'
import Script from 'next/script'
import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import { Analytics } from '@vercel/analytics/react'
import { SoundProvider } from 'src/contexts/SoundContext'

import { AuthContextProvider } from 'src/contexts/AuthContext'
import { ModalContextProvider } from 'src/contexts/ModalContext'
import { SettingsProvider } from 'src/contexts/SettingsContext'
import { TourProvider as TourContextProvider } from 'src/contexts/TourContext'
import { WindowSizeContextProvider } from 'src/contexts/WindowSizeContext'
import type { PageProvider } from 'src/contexts/pageProviders'
import 'src/styles/tailwind.css'
import 'src/styles/themes.css'
import 'react-tooltip/dist/react-tooltip.css'
import 'node_modules/chessground/assets/chessground.base.css'
import 'node_modules/chessground/assets/chessground.brown.css'
import 'node_modules/chessground/assets/chessground.cburnett.css'
import { Compose } from 'src/components/Common/Compose'
import { ErrorBoundary } from 'src/components/Common/ErrorBoundary'
import { FeedbackButton } from 'src/components/Common/FeedbackButton'
import { Footer } from 'src/components/Common/Footer'
import { Header } from 'src/components/Common/Header'
import { loadPostHog } from 'src/lib/posthogClient'
import { whenPageIsIdle } from 'src/lib/whenPageIsIdle'
import { MATERIAL_SYMBOLS_STYLESHEET } from 'src/constants/materialSymbols'
import { markAppHydrated } from 'src/components/Common/PageShell'
import { guardAgainstTranslation } from 'src/lib/translationGuard'

// Before React first touches the page (see src/lib/translationGuard).
if (typeof window !== 'undefined') guardAgainstTranslation()

const openSansClassName = 'font-sans'
const OG_IMAGE_URL = 'https://www.maiachess.com/assets/og-maia.png'
// The material-symbols-ready guard hides icons until the font loads, so
// display=swap never flashes the ligature text.

// Engine pages list the providers they need (see src/contexts/pageProviders).
type PageWithProviders = AppProps['Component'] & { providers?: PageProvider[] }

function MaiaPlatform({ Component, pageProps }: AppProps) {
  const pageProviders = (Component as PageWithProviders).providers ?? []

  // Page shells rendered from now on are rendered normally (PageShell).
  useEffect(markAppHydrated, [])

  // PostHog loads once the page has drawn and the browser is idle (or 5 s
  // after the load event), not before the page can draw; events tracked
  // before then wait for it (src/lib/posthogClient).
  useEffect(() => whenPageIsIdle(loadPostHog, 5000), [])

  useEffect(() => {
    const root = document.documentElement
    const markMaterialSymbolsReady = () => {
      root.classList.add('material-symbols-ready')
    }

    if (!('fonts' in document)) {
      markMaterialSymbolsReady()
      return
    }

    if (document.fonts.check('24px "Material Symbols Outlined"')) {
      markMaterialSymbolsReady()
      return
    }

    document.fonts
      .load('24px "Material Symbols Outlined"')
      .then(markMaterialSymbolsReady)
      .catch(() => undefined)
  }, [])

  return (
    <>
      <TourContextProvider>
        <Compose
          components={[
            SettingsProvider,
            SoundProvider,
            WindowSizeContextProvider,
            AuthContextProvider,
            ErrorBoundary,
            ModalContextProvider,
            ...pageProviders,
          ]}
        >
          <Head>
            <link rel="icon" type="image/png" href="/favicon.png" />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link
              rel="preconnect"
              href="https://fonts.gstatic.com"
              crossOrigin="anonymous"
            />
            <link rel="preload" as="style" href={MATERIAL_SYMBOLS_STYLESHEET} />
            <link rel="stylesheet" href={MATERIAL_SYMBOLS_STYLESHEET} />
            <noscript>
              <link rel="stylesheet" href={MATERIAL_SYMBOLS_STYLESHEET} />
            </noscript>
            <style
              dangerouslySetInnerHTML={{
                __html:
                  // Until the font loads, an icon is laid out as the text of its
                  // name (e.g. "network_intelligence"): keep it 1em wide so the
                  // layout does not change when the icons appear. :where() keeps
                  // icons' own width classes in force.
                  'html:not(.material-symbols-ready) .material-symbols-outlined{visibility:hidden}' +
                  ':where(html:not(.material-symbols-ready) .material-symbols-outlined){width:1em}',
              }}
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
            <meta property="og:image" content={OG_IMAGE_URL} />
            <meta property="og:image:url" content={OG_IMAGE_URL} />
            <meta property="og:image:secure_url" content={OG_IMAGE_URL} />
            <meta property="og:image:alt" content="Maia Chess" />
            <meta property="og:image:type" content="image/png" />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:site_name" content="Maia Chess" />

            {/* Twitter Card meta tags */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:image" content={OG_IMAGE_URL} />
            <meta name="twitter:image:src" content={OG_IMAGE_URL} />
            <meta name="twitter:image:alt" content="Maia Chess" />
          </Head>

          <div className={`${openSansClassName} app-container`}>
            <Header />
            {/* The page area is kept at least a screen tall, so the footer
                starts below the fold: while a page loads (or is rendered
                empty on the server) it would otherwise show under the
                header and then jump down when the page appears. */}
            <div className="content-container min-h-screen">
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
          {/* Google Analytics loads once the page has loaded and the browser
              is idle, so it doesn't run while the page is being drawn. */}
          <Script
            async
            src="/analytics.js?id=G-SNP84LXLKY"
            strategy="lazyOnload"
          />
          <Script id="analytics" strategy="lazyOnload">
            {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-SNP84LXLKY');
          `}
          </Script>
        </Compose>
      </TourContextProvider>
    </>
  )
}

export default MaiaPlatform
