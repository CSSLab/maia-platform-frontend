import Head from 'next/head'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useContext, useState, useEffect } from 'react'

import { getPlayerStats } from 'src/api'
import { UserIcon } from 'src/components/Icons/icons'
import { AuthContext, WindowSizeContext } from 'src/contexts'
import { AuthenticatedWrapper, UserProfile, GameList } from 'src/components'

const ProfilePage: NextPage = () => {
  const router = useRouter()
  const { user } = useContext(AuthContext)
  const [stats, setStats] = useState({
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
    const fetchStats = async () => {
      const playerStats = await getPlayerStats(user?.lichessId)
      setStats(playerStats)
    }

    if (!user?.lichessId) router.push('/')

    fetchStats()
  }, [])

  return (
    <AuthenticatedWrapper>
      <Head>
        <title>Profile – Maia Chess</title>
        <meta name="description" content="User profile and statistics" />
      </Head>
      <Profile stats={stats} />
    </AuthenticatedWrapper>
  )
}

interface Props {
  stats: {
    [key: string]: number
  }
}
const Profile: React.FC<Props> = (props: Props) => {
  const { user } = useContext(AuthContext)
  const { isMobile } = useContext(WindowSizeContext)

  const desktopLayout = () => (
    <div className="flex h-full w-full flex-col items-start justify-center gap-6 px-[4%] md:py-[2%]">
      <div className="flex flex-row items-center gap-4">
        <div className="*:w-16 *:fill-primary">{UserIcon}</div>
        <h1 className="text-3xl font-semibold">{user?.displayName}</h1>
      </div>
      <div className="flex flex-col items-start gap-6 md:flex-row">
        <GameList />
        <UserProfile stats={props.stats} />
      </div>
    </div>
  )

  const mobileLayout = () => (
    <div className="mt-6 flex flex-col gap-3 px-[4%]">
      <div className="flex flex-row items-center gap-3">
        <div className="*:w-12 *:fill-primary">{UserIcon}</div>
        <h1 className="text-3xl font-semibold">{user?.displayName}</h1>
      </div>
      <div className="flex w-full flex-col gap-6">
        <GameList />
        <UserProfile stats={props.stats} />
      </div>
    </div>
  )

  return <>{isMobile ? mobileLayout() : desktopLayout()}</>
}

export default ProfilePage