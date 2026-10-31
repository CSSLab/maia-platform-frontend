import { Html, Head, Main, NextScript } from 'next/document'

/**
 * On /analysis/<id>/lichess, starts fetching the game's PGN (as
 * fetchPgnOfLichessGame does) before the app's JavaScript has loaded; the
 * analysis page takes the request from `window.__lichessPgn`.
 */
const PREFETCH_LICHESS_PGN = `(function () {
  var match = /^\\/analysis\\/([^/]+)\\/lichess\\/?$/.exec(location.pathname)
  if (!match || !window.fetch) return
  var id = decodeURIComponent(match[1])
  var request = fetch('https://lichess.org/game/export/' + id, {
    headers: { Accept: 'application/x-chess-pgn' },
  }).then(function (res) {
    return res.text()
  })
  request.catch(function () {})
  window.__lichessPgn = { id: id, request: request }
})()`

export default function Document() {
  return (
    <Html>
      <Head>
        <script dangerouslySetInnerHTML={{ __html: PREFETCH_LICHESS_PGN }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
