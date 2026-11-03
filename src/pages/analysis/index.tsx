import Head from 'next/head'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Loading } from 'src/components'
import { fetchMaiaGameList } from 'src/api'
import { AnalysisListContext } from 'src/contexts'
import { useContext, useEffect, useRef, useState } from 'react'
import { ANALYSIS_PROVIDERS } from 'src/contexts/pageProviders'

const AnalysisPage: NextPage = () => {
  const { push } = useRouter()
  const { analysisTournamentList, analysisPlayList } =
    useContext(AnalysisListContext)
  const [loading, setLoading] = useState(true)
  // The effect runs again as the lists in the context load; the user's play
  // games are fetched once.
  const playGamesRequest = useRef<ReturnType<typeof fetchMaiaGameList> | null>(
    null,
  )

  useEffect(() => {
    const redirectToGame = async () => {
      // First try to get play games
      if (analysisPlayList.length > 0) {
        const game = analysisPlayList[0]
        push(`/analysis/${game.id}/play`)
        return
      }

      // If no play games in context, try to fetch them directly
      try {
        playGamesRequest.current ??= fetchMaiaGameList('play', 1)
        const playGames = await playGamesRequest.current
        if (playGames.games && playGames.games.length > 0) {
          const gameId = playGames.games[0].game_id
          push(`/analysis/${gameId}/play`)
          return
        }
      } catch (error) {
        console.error('Error fetching play games:', error)
      }

      // If no play games available, fall back to tournament games
      if (analysisTournamentList) {
        const entries = Array.from(analysisTournamentList.entries()).sort(
          (a, b) => b[0].split('---')[1].localeCompare(a[0].split('---')[1]),
        )
        if (entries.length > 0) {
          const [firstPart, games] = entries[0]
          const gameId = firstPart.split('---')[0] + '/' + games[0].game_index
          push(`/analysis/${gameId}`)
        }
      }

      setLoading(false)
    }

    redirectToGame()
  }, [analysisTournamentList, analysisPlayList, push])

  return (
    <>
      <Head>
        <title>Analyze – Maia Chess</title>
        <meta
          name="description"
          content="Analyze chess games with human-aware AI. Combine Stockfish precision with human tendencies learned from millions of games. See what works at your rating level, not just for computers."
        />
      </Head>
      <Loading isLoading={loading}>
        <div></div>
      </Loading>
    </>
  )
}

export default Object.assign(AnalysisPage, { providers: ANALYSIS_PROVIDERS })
