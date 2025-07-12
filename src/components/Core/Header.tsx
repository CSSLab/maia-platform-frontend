/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useCallback, useContext, useEffect, useState } from 'react'

import { PlayType } from 'src/types'
import { AuthContext, ModalContext, WindowSizeContext } from 'src/contexts'
import { MenuIcon, UserIcon, DiscordIcon } from 'src/components/Icons/icons'

export const Header: React.FC = () => {
  const [showMenu, setShowMenu] = useState(false)
  const { isMobile } = useContext(WindowSizeContext)

  const { user, connectLichess, logout } = useContext(AuthContext)

  const router = useRouter()

  const { setPlaySetupModalProps } = useContext(ModalContext)

  const startGame = useCallback(
    (playType: PlayType) => {
      if (
        typeof document !== 'undefined' &&
        document.activeElement instanceof HTMLElement
      ) {
        document.activeElement.blur()
      }
      setPlaySetupModalProps({ playType: playType })
    },
    [setPlaySetupModalProps],
  )

  // Close play dialog if page closed
  useEffect(
    () => () => setPlaySetupModalProps(undefined),
    [setPlaySetupModalProps],
  )

  useEffect(() => {
    const handleRouteChange = () => {
      setShowMenu(false)
    }

    router.events.on('routeChangeStart', handleRouteChange)

    // If the component is unmounted, unsubscribe
    // from the event with the `off` method:
    return () => {
      router.events.off('routeChangeStart', handleRouteChange)
    }
  }, [router])

  const userInfo = user?.lichessId ? (
    <div className="group relative flex w-full items-center gap-3 rounded bg-background-1 px-3 py-2 md:w-auto">
      <i className="h-6 w-6">{UserIcon}</i>
      <div className="flex flex-col">
        <p className="text-sm">{user?.displayName}</p>
        <p className="text-xs text-secondary">View Info</p>
      </div>
      <div className="absolute bottom-[100%] left-0 z-50 hidden w-full overflow-hidden rounded bg-background-2 group-hover:flex group-hover:flex-col md:bottom-auto md:top-[100%]">
        <Link
          href="/profile"
          className="flex w-full items-center justify-start px-3 py-2 hover:bg-background-3"
        >
          Profile
        </Link>
        <button
          onClick={logout}
          className="flex w-full items-center justify-start px-3 py-2 hover:bg-background-3"
        >
          Logout
        </button>
      </div>
    </div>
  ) : (
    <button onClick={connectLichess}>Sign in</button>
  )

  const desktopLayout = (
    <div className="flex w-[90%] flex-row items-center justify-between">
      <div className="flex flex-row items-center justify-start gap-6">
        <Link href="/" className="flex flex-row items-center gap-2">
          <Image src="/maia.png" width={40} height={40} alt="Maia Logo" />
          <h2 className="text-2xl font-bold">Maia Chess</h2>
        </Link>
        <div className="hidden flex-row gap-1 *:px-2 *:py-1 md:flex">
          {user?.lichessId ? (
            <div
              className={`${router.pathname.startsWith('/play') && 'bg-background-1'} group relative`}
            >
              <button className="uppercase">Play</button>
              <div className="absolute left-0 top-[100%] z-30 hidden w-48 flex-col items-start bg-background-1 group-hover:flex">
                <button
                  onClick={() => startGame('againstMaia')}
                  className="flex w-full items-center justify-start px-3 py-2 hover:bg-background-2"
                >
                  Play Maia
                </button>
                <a
                  className="flex w-full items-center justify-start px-3 py-2 hover:bg-background-2"
                  href="https://lichess.org/@/maia1"
                  target="_blank"
                  rel="noreferrer"
                >
                  Play Maia on Lichess
                </a>
                <button
                  onClick={() => startGame('handAndBrain')}
                  className="flex w-full items-center justify-start px-3 py-2 hover:bg-background-2"
                >
                  Play Hand and Brain
                </button>
              </div>
            </div>
          ) : (
            <a
              target="_blank"
              rel="noreferrer"
              href="https://lichess.org/@/maia1"
              className="uppercase"
            >
              Play
            </a>
          )}
          <Link
            href="/analysis"
            className={`${router.pathname.startsWith('/analysis') && 'bg-background-1'} uppercase hover:bg-background-1`}
          >
            Analysis
          </Link>
          <Link
            href="/puzzles"
            className={`${router.pathname.startsWith('/train') && 'bg-background-1'} uppercase hover:bg-background-1`}
          >
            Puzzles
          </Link>
          <Link
            href="/openings"
            className={`${router.pathname.startsWith('/openings') && 'bg-background-1'} uppercase hover:bg-background-1`}
          >
            Openings
          </Link>
          <Link
            href="/turing"
            className={`${router.pathname.startsWith('/turing') && 'bg-background-1'} uppercase hover:bg-background-1`}
          >
            Bot-or-Not
          </Link>
          <Link
            href="/leaderboard"
            className={`${router.pathname.startsWith('/leaderboard') && 'bg-background-1'} uppercase hover:bg-background-1`}
          >
            Leaderboard
          </Link>
          <div className="group relative">
            <button className="-gap-1 flex items-center">
              <p className="uppercase">More</p>
              <i className="material-symbols-outlined">arrow_drop_down</i>
            </button>
            <div className="absolute left-0 top-[100%] z-30 hidden w-32 flex-col items-start bg-background-1 group-hover:flex">
              <Link
                href="/blog"
                className="flex w-full items-center justify-start px-3 py-2 hover:bg-background-2"
              >
                Blog
              </Link>
              <a
                target="_blank"
                rel="noreferrer"
                href="https://twitch.tv/maiachess"
                className="flex w-full items-center justify-start px-3 py-2 hover:bg-background-2"
              >
                Watch
              </a>
              <a
                target="_blank"
                rel="noreferrer"
                href="https://forms.gle/XYeoTJF4YgUu4Vq28"
                className="flex w-full items-center justify-start px-3 py-2 hover:bg-background-2"
              >
                Feedback
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="hidden flex-row items-center gap-3 md:flex">
        <a
          target="_blank"
          rel="noreferrer"
          href="https://discord.gg/Az93GqEAs7"
        >
          {DiscordIcon}
        </a>
        {userInfo}
      </div>
    </div>
  )

  const mobileLayout = (
    <div className="flex w-full flex-row justify-between px-4">
      <Link href="/" passHref>
        <div className="flex flex-row items-center gap-2">
          <Image src="/maia.png" width={40} height={40} alt="Maia Logo" />
          <h2 className="text-2xl font-bold">Maia Chess</h2>
        </div>
      </Link>
      <button
        className="block cursor-pointer *:*:fill-primary md:hidden"
        onClick={() => setShowMenu((show) => !show)}
      >
        {MenuIcon}
      </button>
      {showMenu && (
        <div className="fixed left-0 top-0 z-50 flex h-screen w-screen flex-col items-start justify-between bg-backdrop py-4">
          <div className="flex w-full flex-row justify-between px-4">
            <Link href="/" passHref>
              <div className="flex flex-row items-center gap-2">
                <Image src="/maia.png" width={40} height={40} alt="Maia Logo" />
                <h2 className="text-2xl font-bold">Maia Chess</h2>
              </div>
            </Link>
            <button
              className="block cursor-pointer *:*:fill-primary md:hidden"
              onClick={() => setShowMenu(false)}
            >
              {MenuIcon}
            </button>
          </div>
          <div className="flex flex-col gap-6 px-12">
            {user?.lichessId ? (
              <div className="flex flex-col items-start justify-center gap-6">
                <button>PLAY</button>
                <div className="flex flex-col items-start justify-center gap-4">
                  <button onClick={() => startGame('againstMaia')}>
                    Play Maia
                  </button>
                  <a
                    href="https://lichess.org/@/maia1"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Play Maia on Lichess
                  </a>
                  <button onClick={() => startGame('handAndBrain')}>
                    Play Hand and Brain
                  </button>
                </div>
              </div>
            ) : (
              <a
                target="_blank"
                rel="noreferrer"
                href="https://lichess.org/@/maia1"
              >
                Play
              </a>
            )}
            <Link href="/analysis" className="uppercase">
              Analysis
            </Link>
            <Link href="/train" className="uppercase">
              Train
            </Link>
            <Link href="/openings" className="uppercase">
              Openings
            </Link>
            <Link href="/turing" className="uppercase">
              Bot-or-not
            </Link>
            <Link href="/leaderboard" className="uppercase">
              Leaderboard
            </Link>
            <Link href="/blog" className="uppercase">
              Blog
            </Link>
            <a
              target="_blank"
              rel="noreferrer"
              href="https://twitch.tv/maiachess"
              className="uppercase"
            >
              Watch
            </a>
            <a
              target="_blank"
              rel="noreferrer"
              href="https://forms.gle/XYeoTJF4YgUu4Vq28"
              className="uppercase"
            >
              Feedback
            </a>
          </div>
          <div className="flex w-full flex-row items-center gap-3 px-4">
            <a
              target="_blank"
              rel="noreferrer"
              href="https://discord.gg/Az93GqEAs7"
            >
              <div className="h-6 w-6">{DiscordIcon}</div>
            </a>
            {userInfo}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      <div className="flex w-screen flex-row items-center justify-center pb-1 pt-4 md:pb-0">
        {isMobile ? mobileLayout : desktopLayout}
      </div>
    </>
  )
}
