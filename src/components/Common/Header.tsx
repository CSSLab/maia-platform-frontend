/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import Link from 'next/link'
import Image from 'next/image'
import { PlayType } from 'src/types'
import { useRouter } from 'next/router'
import { DiscordIcon } from './Icons'
import { useCallback, useContext, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AuthContext, ModalContext, WindowSizeContext } from 'src/contexts'
import { LeaderboardNavBadge } from '../Leaderboard/LeaderboardNavBadge'
import { useLeaderboardStatus } from 'src/hooks/useLeaderboardStatus'

export const Header: React.FC = () => {
  const [showMenu, setShowMenu] = useState(false)
  const [showPlayDropdown, setShowPlayDropdown] = useState(false)
  const [showMoreDropdown, setShowMoreDropdown] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const { isMobile, width } = useContext(WindowSizeContext)

  const { user, connectLichess, logout } = useContext(AuthContext)

  // Get leaderboard status for the logged in user
  const { status: leaderboardStatus, loading: leaderboardLoading } =
    useLeaderboardStatus(user?.displayName)

  const router = useRouter()

  const { setPlaySetupModalProps } = useContext(ModalContext)

  const isCompactDesktopNav = !isMobile && width > 0 && width < 1300

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

  useEffect(() => {
    if (showMenu) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showMenu])

  const userInfo = user?.lichessId ? (
    <div
      className="relative flex items-center gap-2 rounded-full border border-white/10 bg-[#171214] px-3 py-1.5 transition-all duration-200 hover:border-white/20"
      onMouseEnter={() => setShowProfileDropdown(true)}
      onMouseLeave={() => setShowProfileDropdown(false)}
    >
      <span className="material-symbols-outlined text-xl text-primary/80">
        account_circle
      </span>
      <span className="text-sm font-medium text-primary/90">
        {user?.displayName}
      </span>
      <motion.i
        className="material-symbols-outlined text-sm text-primary/60"
        animate={{ rotate: showProfileDropdown ? 180 : 0 }}
        transition={{ duration: 0.2 }}
      >
        arrow_drop_down
      </motion.i>
      <AnimatePresence>
        {showProfileDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-[100%] left-0 z-50 w-full overflow-hidden rounded-md border border-white/10 bg-[#171214] md:bottom-auto md:top-[100%]"
          >
            <div className="divide-y divide-white/5">
              <Link
                href="/profile"
                className="flex w-full items-center justify-start px-3 py-2 text-sm text-white/90 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              >
                Profile
              </Link>
              <Link
                href="/settings"
                className="flex w-full items-center justify-start px-3 py-2 text-sm text-white/90 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              >
                Settings
              </Link>
              <button
                onClick={logout}
                className="flex w-full items-center justify-start px-3 py-2 text-sm text-white/90 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              >
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ) : (
    <button
      onClick={connectLichess}
      className="px-2 py-1 text-sm tracking-wide text-primary/80 transition-all duration-200 hover:text-primary"
    >
      Sign in
    </button>
  )

  const desktopLayout = (
    <div className="flex w-[90%] flex-row items-center justify-between">
      <div className="flex flex-row items-center justify-start gap-6">
        <Link href="/" className="flex flex-row items-center gap-2">
          <Image src="/maia.png" width={40} height={40} alt="Maia Logo" />
          <h2 className="text-2xl font-bold">Maia Chess</h2>
        </Link>
        <div className="hidden flex-row gap-1 text-sm tracking-wider md:flex">
          <div
            className="relative"
            onMouseEnter={() => setShowPlayDropdown(true)}
            onMouseLeave={() => setShowPlayDropdown(false)}
          >
            <button
              className={`-gap-1 flex items-center px-2 py-1 transition-all duration-200 hover:!text-primary ${router.pathname.startsWith('/play') ? '!text-primary' : '!text-primary/80'}`}
            >
              <p>PLAY</p>
              <motion.i
                className="material-symbols-outlined text-sm"
                animate={{ rotate: showPlayDropdown ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                arrow_drop_down
              </motion.i>
            </button>
            <AnimatePresence>
              {showPlayDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute left-0 top-[100%] z-30 w-48 overflow-hidden rounded-md border border-white/10 bg-[#171214]"
                >
                  <div className="divide-y divide-white/5">
                    <button
                      onClick={() => startGame('againstMaia')}
                      className="flex w-full items-center justify-start px-3 py-2 text-sm text-white/90 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                    >
                      Play Maia
                    </button>
                    <button
                      onClick={() => startGame('handAndBrain')}
                      className="flex w-full items-center justify-start px-3 py-2 text-sm text-white/90 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                    >
                      Play Hand and Brain
                    </button>
                    <a
                      className="flex w-full items-center justify-start px-3 py-2 text-sm text-white/90 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                      href="https://lichess.org/@/maia1"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Play Maia on Lichess
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Link
            href="/analysis"
            className={`px-2 py-1 transition-all duration-200 hover:!text-primary ${router.pathname.startsWith('/analysis') ? '!text-primary' : '!text-primary/80'}`}
          >
            ANALYSIS
          </Link>
          <Link
            href="/puzzles"
            className={`px-2 py-1 transition-all duration-200 hover:!text-primary ${router.pathname.startsWith('/puzzles') ? '!text-primary' : '!text-primary/80'}`}
          >
            PUZZLES
          </Link>
          <Link
            href="/openings"
            className={`px-2 py-1 transition-all duration-200 hover:!text-primary ${router.pathname.startsWith('/openings') ? '!text-primary' : '!text-primary/80'}`}
          >
            OPENINGS
          </Link>
          <Link
            href="/turing"
            className={`px-2 py-1 transition-all duration-200 hover:!text-primary ${router.pathname.startsWith('/turing') ? '!text-primary' : '!text-primary/80'}`}
          >
            BOT-OR-NOT
          </Link>
          {!isCompactDesktopNav && (
            <Link
              href="/broadcast"
              className={`px-2 py-1 transition-all duration-200 hover:!text-primary ${router.pathname.startsWith('/broadcast') ? '!text-primary' : '!text-primary/80'}`}
            >
              BROADCASTS
            </Link>
          )}
          {!isCompactDesktopNav && (
            <Link
              href="/leaderboard"
              className={`px-2 py-1 transition-all duration-200 hover:!text-primary ${router.pathname.startsWith('/leaderboard') ? '!text-primary' : '!text-primary/80'}`}
            >
              LEADERBOARD
            </Link>
          )}
          <div
            className="relative"
            onMouseEnter={() => setShowMoreDropdown(true)}
            onMouseLeave={() => setShowMoreDropdown(false)}
          >
            <button className="-gap-1 flex items-center px-2 py-1 !text-primary/80 transition-all duration-200 hover:!text-primary">
              <p>MORE</p>
              <motion.i
                className="material-symbols-outlined text-sm"
                animate={{ rotate: showMoreDropdown ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                arrow_drop_down
              </motion.i>
            </button>
            <AnimatePresence>
              {showMoreDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute left-0 top-[100%] z-30 w-32 overflow-hidden rounded-md border border-white/10 bg-[#171214]"
                >
                  <div className="divide-y divide-white/5">
                    {isCompactDesktopNav && (
                      <Link
                        href="/broadcast"
                        className={`flex w-full items-center justify-start px-3 py-2 text-sm transition-colors hover:bg-[rgba(255,255,255,0.04)] ${
                          router.pathname.startsWith('/broadcast')
                            ? 'text-primary'
                            : 'text-white/90'
                        }`}
                      >
                        Broadcasts
                      </Link>
                    )}
                    {isCompactDesktopNav && (
                      <Link
                        href="/leaderboard"
                        className={`flex w-full items-center justify-start px-3 py-2 text-sm transition-colors hover:bg-[rgba(255,255,255,0.04)] ${
                          router.pathname.startsWith('/leaderboard')
                            ? 'text-primary'
                            : 'text-white/90'
                        }`}
                      >
                        Leaderboard
                      </Link>
                    )}
                    <Link
                      href="/blog"
                      className="flex w-full items-center justify-start px-3 py-2 text-sm text-white/90 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                    >
                      Blog
                    </Link>
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href="https://twitch.tv/maiachess"
                      className="flex w-full items-center justify-start px-3 py-2 text-sm text-white/90 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                    >
                      Watch
                    </a>
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href="https://forms.gle/XYeoTJF4YgUu4Vq28"
                      className="flex w-full items-center justify-start px-3 py-2 text-sm text-white/90 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                    >
                      Feedback
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
        {user?.lichessId && (
          <LeaderboardNavBadge
            status={leaderboardStatus}
            loading={leaderboardLoading}
          />
        )}
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
        <span className="material-symbols-outlined text-3xl">menu</span>
      </button>
      {showMenu && (
        <div className="fixed left-0 top-0 z-40 flex h-screen w-screen flex-col items-start justify-between bg-backdrop py-4">
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
              <span className="material-symbols-outlined text-3xl">menu</span>
            </button>
          </div>
          <div className="flex flex-col gap-6 px-12">
            <div className="flex flex-col items-start justify-center gap-6">
              <button>PLAY</button>
              <div className="flex flex-col items-start justify-center gap-4">
                <button onClick={() => startGame('againstMaia')}>
                  Play Maia
                </button>

                <button onClick={() => startGame('handAndBrain')}>
                  Play Hand and Brain
                </button>
                <a
                  href="https://lichess.org/@/maia1"
                  target="_blank"
                  rel="noreferrer"
                >
                  Play Maia on Lichess
                </a>
              </div>
            </div>
            <Link href="/analysis" className="uppercase">
              Analysis
            </Link>
            <Link href="/puzzles" className="uppercase">
              Puzzles
            </Link>
            <Link href="/openings" className="uppercase">
              Openings
            </Link>
            <Link href="/turing" className="uppercase">
              Bot-or-not
            </Link>
            <Link href="/broadcast" className="uppercase">
              Broadcasts
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
            {user?.lichessId && (
              <>
                <Link href="/profile" className="uppercase">
                  Profile
                </Link>
                <Link href="/settings" className="uppercase">
                  Settings
                </Link>
                <button onClick={logout} className="text-left uppercase">
                  Logout
                </button>
              </>
            )}
          </div>
          <div className="flex w-full flex-row items-center gap-3 px-4">
            <a
              target="_blank"
              rel="noreferrer"
              href="https://discord.gg/Az93GqEAs7"
            >
              <div className="h-6 w-6">{DiscordIcon}</div>
            </a>
            {user?.lichessId && (
              <LeaderboardNavBadge
                status={leaderboardStatus}
                loading={leaderboardLoading}
              />
            )}
            {user?.lichessId ? (
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl text-primary/80">
                  account_circle
                </span>
                <span className="text-sm font-medium text-primary/90">
                  {user?.displayName}
                </span>
              </div>
            ) : (
              <button onClick={connectLichess} className="uppercase">
                Sign in
              </button>
            )}
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
