import { Html, Head, Main, NextScript } from 'next/document'

/**
 * Starts requests the first render waits for before the app's JavaScript has
 * loaded: the account (as fetchAccount does, taken from `window.__account`);
 * on /puzzles, the first puzzle (as fetchPuzzle does, taken from
 * `window.__puzzle`; the backend takes ~1.6 s, which on a phone started ~1 s
 * after the page did); and, on /analysis/<id>/lichess, the game's PGN (as
 * fetchPgnOfLichessGame does, taken from `window.__lichessPgn`).
 */
const EARLY_REQUESTS = `(function () {
  if (!window.fetch) return
  var account = fetch('/api/v1/auth/account').then(function (res) {
    return res.json()
  })
  account.catch(function () {})
  window.__account = account

  // Needs the guest cookie: on a first visit it fails and the page asks again.
  if (/^\\/puzzles\\/?$/.test(location.pathname)) {
    var puzzle = fetch('/api/v1/puzzle/new_puzzle').then(function (res) {
      if (!res.ok) throw new Error(String(res.status))
      return res.json()
    })
    puzzle.catch(function () {})
    window.__puzzle = puzzle
  }

  var match = /^\\/analysis\\/([^/]+)\\/lichess\\/?$/.exec(location.pathname)
  if (!match) return
  var id = decodeURIComponent(match[1])
  var request = fetch('https://lichess.org/game/export/' + id + '?clocks=true&evals=true&opening=true', {
    headers: { Accept: 'application/x-chess-pgn' },
  }).then(function (res) {
    return res.ok ? res.text() : ''
  })
  request.catch(function () {})
  window.__lichessPgn = { id: id, request: request }
})()`

/**
 * Gives the body the visitor's board theme class before the first paint, as
 * SettingsContext does once the app has loaded, so that boards drawn in the
 * server's HTML (page shells) don't change colour then.
 */
const BOARD_THEME = `try {
  var theme = JSON.parse(localStorage.getItem('maia-user-settings') || '{}')
    .chessboardTheme
  if (/^[a-z0-9-]+$/.test(theme)) document.body.classList.add('theme-' + theme)
} catch (e) {}`

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* The site is already dark. Saying so stops browsers' automatic
            dark modes (Chrome on Android, Samsung Internet) and the Dark
            Reader extension from inverting it, which turned Black's pieces
            white. */}
        <meta name="color-scheme" content="dark" />
        <meta name="darkreader-lock" />
        {/* Installable as an app (public/manifest.webmanifest). */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#171214" />
        <script dangerouslySetInnerHTML={{ __html: EARLY_REQUESTS }} />
      </Head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: BOARD_THEME }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
