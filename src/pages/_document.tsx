import { Html, Head, Main, NextScript } from 'next/document'

/**
 * Starts requests the first render waits for before the app's JavaScript has
 * loaded: the account (as fetchAccount does, taken from `window.__account`)
 * and, on /analysis/<id>/lichess, the game's PGN (as fetchPgnOfLichessGame
 * does, taken from `window.__lichessPgn`).
 */
const EARLY_REQUESTS = `(function () {
  if (!window.fetch) return
  var account = fetch('/api/v1/auth/account').then(function (res) {
    return res.json()
  })
  account.catch(function () {})
  window.__account = account

  var match = /^\\/analysis\\/([^/]+)\\/lichess\\/?$/.exec(location.pathname)
  if (!match) return
  var id = decodeURIComponent(match[1])
  var request = fetch('https://lichess.org/game/export/' + id, {
    headers: { Accept: 'application/x-chess-pgn' },
  }).then(function (res) {
    return res.ok ? res.text() : ''
  })
  request.catch(function () {})
  window.__lichessPgn = { id: id, request: request }
})()`

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: EARLY_REQUESTS }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
