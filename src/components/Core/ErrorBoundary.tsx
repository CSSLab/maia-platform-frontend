import Link from 'next/link'
import { Component } from 'react'
import { Open_Sans } from 'next/font/google'
import Chessground from '@react-chess/chessground'
import { Header } from './Header'
import { Footer } from './Footer'
import { trackErrorEncountered } from 'src/utils/analytics'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  isUnauthorized: boolean
  error: Error | null
}

const OpenSans = Open_Sans({ subsets: ['latin'] })

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, isUnauthorized: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    console.log('Error caught in getDerivedStateFromError:', error)
    return { hasError: true, error: error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.log('Error caught in componentDidCatch:', error, errorInfo)

    // Track error in PostHog
    try {
      const currentPage =
        typeof window !== 'undefined' ? window.location.pathname : 'unknown'
      const errorType = error.name || 'Unknown Error'
      const errorMessage = error.message || 'No message available'

      trackErrorEncountered(
        errorType,
        currentPage,
        'component_error',
        errorMessage,
      )
    } catch (trackingError) {
      console.error('Failed to track error:', trackingError)
    }

    if (error.message === 'Unauthorized') {
      this.setState({ hasError: true, isUnauthorized: true, error })
    } else {
      this.setState({ hasError: true, isUnauthorized: false, error })
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.isUnauthorized) {
        return (
          <div className={`${OpenSans.className} app-container`}>
            <div className="flex min-h-screen w-screen flex-col bg-backdrop">
              <Header />
              <div className="flex flex-1 flex-col items-center justify-center gap-4">
                <h2 className="text-3xl font-bold text-primary">
                  Unauthorized Access
                </h2>
                <p className="text-primary">
                  You do not have permission to view this content. Please log
                  in.
                </p>
                <Link
                  href="/"
                  className="flex items-center justify-center rounded bg-human-3 px-8 py-2 transition duration-200 hover:bg-human-4"
                  onClick={() => this.setState({ hasError: false })}
                >
                  <span className="text-lg text-primary">
                    Click here to go home
                  </span>
                </Link>
              </div>
              <Footer />
            </div>
          </div>
        )
      }

      return (
        <div className="flex min-h-screen w-screen flex-col bg-backdrop">
          <Header />
          <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
            <div className="flex max-w-2xl flex-col items-center gap-6 text-center">
              <div className="h-[200px] w-[200px] opacity-75">
                <Chessground
                  contained
                  config={{
                    fen: 'rn1qkb1r/ppp1pBpp/5n2/4N3/8/2N5/PPPP1PPP/R1BbK2R b KQkq - 0 7',
                    check: 'black',
                  }}
                />
              </div>

              <div className="space-y-3">
                <h2 className="text-4xl font-bold text-primary">
                  Oops! Something went wrong
                </h2>
                <p className="text-lg text-secondary">
                  We&apos;re sorry for the inconvenience. An unexpected error
                  occurred while loading the page.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/"
                  className="flex items-center justify-center rounded-lg bg-human-3 px-6 py-3 transition duration-200 hover:bg-human-4"
                  onClick={() => this.setState({ hasError: false })}
                >
                  <span className="font-medium text-primary">
                    Return to Home
                  </span>
                </Link>

                <Link
                  href="https://discord.gg/hHb6gqFpxZ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center rounded-lg border border-human-3 px-6 py-3 transition duration-200 hover:bg-human-3/20"
                >
                  <span className="font-medium text-primary">
                    Get Help on Discord
                  </span>
                </Link>
              </div>
            </div>

            <div className="w-full max-w-2xl rounded-lg bg-background-1 p-4">
              <details className="cursor-pointer">
                <summary className="mb-3 font-medium text-primary">
                  Technical Details (click to expand)
                </summary>
                <div className="space-y-3">
                  <p className="text-sm text-secondary">
                    If you continue to experience this issue, please share the
                    following error details with our support team on Discord:
                  </p>
                  <code className="block overflow-x-auto rounded bg-background-2 p-3 text-xs text-secondary">
                    {this.state.error?.stack ||
                      this.state.error?.toString() ||
                      'Unknown error'}
                  </code>
                  <p className="text-tertiary text-xs">
                    Timestamp: {new Date().toISOString()}
                  </p>
                </div>
              </details>
            </div>
          </div>
          <Footer />
        </div>
      )
    }

    return this.props.children
  }
}
