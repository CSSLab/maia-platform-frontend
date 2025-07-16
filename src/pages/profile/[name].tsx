import Head from 'next/head'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useContext, useState, useEffect } from 'react'

import { PlayerStats } from 'src/types'
import { getPlayerStats } from 'src/api'
import { WindowSizeContext } from 'src/contexts'
import { AuthenticatedWrapper, UserProfile } from 'src/components'

const ProfilePage: NextPage = () => {
  const router = useRouter()
  const [name, setName] = useState('')
  const [stats, setStats] = useState<PlayerStats>({
    regularRating: 0,
    regularWins: 0,
    regularDraws: 0,
    regularGames: 0,
    regularMax: 0,
    regularMin: 0,
    regularHours: 0,

    handRating: 0,
    handWins: 0,
    handDraws: 0,
    handGames: 0,
    handMax: 0,
    handMin: 0,
    handHours: 0,

    brainRating: 0,
    brainWins: 0,
    brainDraws: 0,
    brainGames: 0,
    brainMax: 0,
    brainMin: 0,
    brainHours: 0,

    trainRating: 0,
    trainCorrect: 0,
    trainGames: 0,
    trainMax: 0,
    trainMin: 0,
    trainHours: 0,

    botNotRating: 0,
    botNotCorrect: 0,
    botNotWrong: 0,
    botNotMax: 0,
    botNotMin: 0,
    botNotHours: 0,
  })

  useEffect(() => {
    const fetchStats = async (n: string) => {
      const playerStats = await getPlayerStats(n)
      setName(n)
      setStats(playerStats)
    }

    if (router.query.name) {
      fetchStats(router.query.name as string)
    }
  }, [router.query])

  return (
    <AuthenticatedWrapper>
      <Head>
        <title>
          {name ? `${name}'s Profile – Maia Chess` : 'Profile – Maia Chess'}
        </title>
        <meta
          name="description"
          content={
            name
              ? `View ${name}'s chess statistics and ratings across all Maia Chess game modes. See performance in regular play, puzzles, hand & brain, and bot detection challenges.`
              : 'View player profiles and comprehensive chess statistics on Maia Chess. Track ratings, games played, and performance across all game modes.'
          }
        />
      </Head>
      <Profile name={name} stats={stats} />
    </AuthenticatedWrapper>
  )
}

interface Props {
  name: string
  stats: PlayerStats
}
const Profile: React.FC<Props> = (props: Props) => {
  const { isMobile } = useContext(WindowSizeContext)

  const desktopLayout = (
    <div className="mx-auto flex h-full w-[90%] flex-col items-start justify-center gap-6 md:py-[2%]">
      <div className="flex flex-row items-center gap-2">
        <span className="material-symbols-outlined text-6xl">
          account_circle
        </span>
        <div className="flex flex-col">
          <h1 className="text-3xl font-semibold">{props.name}</h1>
          <a
            href={`https://lichess.org/@/${props.name}`}
            className="text-sm text-primary"
          >
            View on Lichess
          </a>
        </div>
      </div>
      <div className="flex w-full flex-col items-start gap-6 md:flex-row">
        <UserProfile stats={props.stats} wide />
      </div>
    </div>
  )

  const mobileLayout = (
    <div className="mx-auto mt-6 flex w-[90%] flex-col gap-3">
      <div className="flex flex-row items-center gap-2 md:gap-3">
        <span className="material-symbols-outlined text-4xl">
          account_circle
        </span>
        <h1 className="text-3xl font-semibold">{props.name}</h1>
      </div>
      <div className="flex w-full flex-col gap-6">
        <UserProfile stats={props.stats} wide />
      </div>
    </div>
  )

  return <>{isMobile ? mobileLayout : desktopLayout}</>
}

export default ProfilePage
