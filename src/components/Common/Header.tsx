/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import Link from 'next/link'
import { LichessSignInButton } from 'src/components/Common/LichessSignInButton'
import { ConnectButtonSlot } from 'src/components/Common/ConnectButtonSlot'
import Image from 'next/image'
// Imported, so its address names its contents and browsers keep it a year.
import maiaLogo from 'public/maia-ios-icon.png'
import { PlayType } from 'src/types'
import { useRouter } from 'next/router'
import { DiscordIcon } from './Icons'
import { DISCORD_URL } from 'src/lib/communityLinks'
import { trackCommunityLinkClicked } from 'src/lib/analytics'
import {
  FocusEvent,
  KeyboardEvent,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AuthContext } from 'src/contexts/AuthContext'
import { ModalContext } from 'src/contexts/ModalContext'
import { WindowSizeContext } from 'src/contexts/WindowSizeContext'
import { LeaderboardNavBadge } from '../Leaderboard/LeaderboardNavBadge'
import { useLeaderboardStatus } from 'src/hooks/useLeaderboardStatus'
import { NotificationBell } from '../Notifications/NotificationBell'
import { useNotifications } from 'src/hooks/useNotifications'
import {
  ANALYSIS_MENU_ITEMS,
  AnalysisMenuRequest,
  OPEN_ANALYSIS_LIST_EVENT,
  OPEN_ANALYSIS_LIST_KEY,
} from 'src/constants/analysis'

// A header menu opens on hover, keyboard focus or a click (or tap), and
// closes when the pointer or the focus leaves it, or on Escape.
const menuProps = (setOpen: (open: boolean) => void) => ({
  onMouseEnter: () => setOpen(true),
  onMouseLeave: () => setOpen(false),
  onFocus: () => setOpen(true),
  onBlur: (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setOpen(false)
    }
  },
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') setOpen(false)
  },
})

export const Header: React.FC = () => {
  const [showMenu, setShowMenu] = useState(false)
  const [showPlayDropdown, setShowPlayDropdown] = useState(false)
  const [showMoreDropdown, setShowMoreDropdown] = useState(false)
  const [showAnalysisDropdown, setShowAnalysisDropdown] = useState(false)

  const openAnalysisList = (request: AnalysisMenuRequest) => {
    setShowAnalysisDropdown(false)
    if (router.pathname === '/analysis/[...id]') {
      window.dispatchEvent(
        new CustomEvent(OPEN_ANALYSIS_LIST_EVENT, { detail: request }),
      )
      return
    }
    try {
      sessionStorage.setItem(OPEN_ANALYSIS_LIST_KEY, request)
    } catch {
      // Without storage the analysis page still opens, on its usual tab.
    }
    router.push('/analysis')
  }
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const { isMobile, width } = useContext(WindowSizeContext)

  const { user, logout } = useContext(AuthContext)

  // Get leaderboard status for the logged in user
  const { status: leaderboardStatus, loading: leaderboardLoading } =
    useLeaderboardStatus(user?.displayName)

  // Every account has notifications, a guest's too.
  const notifications = useNotifications(user?.clientId)
  const discordLink = (
    <a
      target="_blank"
      rel="noreferrer"
      href={DISCORD_URL}
      onClick={() => trackCommunityLinkClicked('discord', 'header')}
      aria-label="Discord"
      title="Discord"
      // The icon is an SVG with only a viewBox: without a size here it
      // collapses to nothing. It takes the bell's 24px box, drawn a little
      // smaller than the box, because a solid logo looks heavier than the
      // outlined bell and account icons beside it.
      className="flex h-6 w-6 items-center justify-center text-primary/80 transition-colors duration-200 hover:text-primary [&>svg]:h-[15px] [&>svg]:w-5 [&>svg]:fill-current"
    >
      {DiscordIcon}
    </a>
  )

  const notificationBell = (
    <NotificationBell
      unreadCount={notifications.unreadCount}
      notifications={notifications.notifications}
      status={notifications.status}
      open={notifications.open}
      onOpenChange={notifications.setOpen}
      onRetry={notifications.retry}
    />
  )

  const router = useRouter()

  const { setPlaySetupModalProps } = useContext(ModalContext)

  const isCompactDesktopNav = !isMobile && width > 0 && width < 1440
  // Narrower still, the logo stands alone (no "Maia Chess").
  const isNarrowDesktopNav = !isMobile && width > 0 && width < 1200

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
      className="relative flex items-center gap-2 rounded-full border border-glass-border bg-backdrop px-3 py-1.5 transition-all duration-200 hover:border-white/20"
      {...menuProps(setShowProfileDropdown)}
    >
      <button
        type="button"
        className="flex items-center gap-2"
        aria-expanded={showProfileDropdown}
        onClick={() => setShowProfileDropdown(true)}
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
      </button>
      <AnimatePresence>
        {showProfileDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-[100%] left-0 z-50 w-full overflow-hidden rounded-md border border-glass-border bg-backdrop md:bottom-auto md:top-[100%]"
          >
            <div className="divide-y divide-glass-border tracking-wide">
              <Link
                href="/profile"
                className="flex w-full items-center justify-start px-3 py-2 text-sm text-primary transition-colors hover:bg-glass"
              >
                Profile
              </Link>
              <Link
                href="/settings"
                className="flex w-full items-center justify-start px-3 py-2 text-sm text-primary transition-colors hover:bg-glass"
              >
                Settings
              </Link>
              <button
                onClick={logout}
                className="flex w-full items-center justify-start px-3 py-2 text-sm text-primary transition-colors hover:bg-glass"
              >
                Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ) : (
    <>
      {/* Settings (board theme, sounds) are kept in the browser, so they're
          open to visitors without an account too; signed-in users find them
          in their profile menu. */}
      <Link
        href="/settings"
        aria-label="Settings"
        title="Settings"
        className={`flex items-center transition-all duration-200 hover:text-primary ${router.pathname.startsWith('/settings') ? 'text-primary' : 'text-primary/80'}`}
      >
        <span className="material-symbols-outlined text-2xl">settings</span>
      </Link>
      <LichessSignInButton source="header" />
    </>
  )

  const desktopLayout = (
    <div
      className={`flex flex-row items-center justify-between ${isCompactDesktopNav ? 'w-[96%]' : 'w-[90%]'}`}
    >
      <div
        className={`flex flex-row items-center justify-start ${isCompactDesktopNav ? 'gap-3' : 'gap-6'}`}
      >
        <Link href="/" className="flex flex-row items-center gap-2">
          <Image src={maiaLogo} width={40} height={40} alt="Maia Logo" />
          {!isNarrowDesktopNav && (
            <h2 className="whitespace-nowrap text-2xl font-bold">Maia Chess</h2>
          )}
        </Link>
        <div
          className={`hidden flex-row items-center text-sm tracking-wider md:flex ${isCompactDesktopNav ? 'gap-0' : 'gap-1'}`}
        >
          <div className="relative" {...menuProps(setShowPlayDropdown)}>
            <button
              aria-expanded={showPlayDropdown}
              onClick={() => setShowPlayDropdown(true)}
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
                  className="absolute left-0 top-[100%] z-30 w-48 overflow-hidden rounded-md border border-glass-border bg-backdrop"
                >
                  <div className="divide-y divide-glass-border tracking-wide">
                    <button
                      onClick={() => startGame('againstMaia')}
                      className="flex w-full items-center justify-start px-3 py-2 text-sm text-primary transition-colors hover:bg-glass"
                    >
                      Play Maia
                    </button>
                    <button
                      onClick={() => startGame('handAndBrain')}
                      className="flex w-full items-center justify-start px-3 py-2 text-sm text-primary transition-colors hover:bg-glass"
                    >
                      Play Hand and Brain
                    </button>
                    <a
                      className="flex w-full items-center justify-start px-3 py-2 text-sm text-primary transition-colors hover:bg-glass"
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
          <div className="relative" {...menuProps(setShowAnalysisDropdown)}>
            <Link
              href="/analysis"
              aria-haspopup="menu"
              aria-expanded={showAnalysisDropdown}
              onClick={() => setShowAnalysisDropdown(false)}
              className={`-gap-1 flex items-center px-2 py-1 transition-all duration-200 hover:!text-primary ${router.pathname.startsWith('/analysis') ? '!text-primary' : '!text-primary/80'}`}
            >
              <p>ANALYSIS</p>
              <motion.i
                className="material-symbols-outlined text-sm"
                animate={{ rotate: showAnalysisDropdown ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                arrow_drop_down
              </motion.i>
            </Link>
            <AnimatePresence>
              {showAnalysisDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute left-0 top-[100%] z-30 w-56 overflow-hidden rounded-md border border-glass-border bg-backdrop"
                >
                  <div className="divide-y divide-glass-border tracking-wide">
                    {ANALYSIS_MENU_ITEMS.map((item) => (
                      <button
                        key={item.request}
                        onClick={() => openAnalysisList(item.request)}
                        className="flex w-full items-center justify-start px-3 py-2 text-sm text-primary transition-colors hover:bg-glass"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Link
            href="/puzzles"
            className={`px-2 py-1 transition-all duration-200 hover:!text-primary ${router.pathname.startsWith('/puzzles') ? '!text-primary' : '!text-primary/80'}`}
          >
            PUZZLES
          </Link>
          <Link
            href="/drills"
            className={`px-2 py-1 transition-all duration-200 hover:!text-primary ${router.pathname.startsWith('/drills') ? '!text-primary' : '!text-primary/80'}`}
          >
            DRILLS
          </Link>
          {!isCompactDesktopNav && (
            <Link
              href="/turing"
              className={`px-2 py-1 transition-all duration-200 hover:!text-primary ${router.pathname.startsWith('/turing') ? '!text-primary' : '!text-primary/80'}`}
            >
              BOT-OR-NOT
            </Link>
          )}
          <Link
            href="/broadcast"
            className={`px-2 py-1 transition-all duration-200 hover:!text-primary ${router.pathname.startsWith('/broadcast') ? '!text-primary' : '!text-primary/80'}`}
          >
            BROADCASTS
          </Link>
          <div className="relative" {...menuProps(setShowMoreDropdown)}>
            <button
              aria-expanded={showMoreDropdown}
              onClick={() => setShowMoreDropdown(true)}
              className="-gap-1 flex items-center px-2 py-1 !text-primary/80 transition-all duration-200 hover:!text-primary"
            >
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
                  className="absolute left-0 top-[100%] z-30 w-32 overflow-hidden rounded-md border border-glass-border bg-backdrop"
                >
                  <div className="divide-y divide-glass-border tracking-wide">
                    {isCompactDesktopNav && (
                      <Link
                        href="/turing"
                        className={`flex w-full items-center justify-start px-3 py-2 text-sm transition-colors hover:bg-glass ${
                          router.pathname.startsWith('/turing')
                            ? 'text-primary'
                            : 'text-white/90'
                        }`}
                      >
                        Bot-or-Not
                      </Link>
                    )}
                    <Link
                      href="/leaderboard"
                      className={`flex w-full items-center justify-start px-3 py-2 text-sm transition-colors hover:bg-glass ${
                        router.pathname.startsWith('/leaderboard')
                          ? 'text-primary'
                          : 'text-white/90'
                      }`}
                    >
                      Leaderboard
                    </Link>
                    <Link
                      href="/blog"
                      className="flex w-full items-center justify-start px-3 py-2 text-sm text-white/90 transition-colors hover:bg-glass"
                    >
                      Maia Blog
                    </Link>
                    {/* <a
                      target="_blank"
                      rel="noreferrer"
                      href="https://twitch.tv/maiachess"
                      className="flex w-full items-center justify-start px-3 py-2 text-sm text-white/90 transition-colors hover:bg-glass"
                    >
                      Watch
                    </a> */}
                    {/* <a
                      target="_blank"
                      rel="noreferrer"
                      href="https://forms.gle/XYeoTJF4YgUu4Vq28"
                      className="flex w-full items-center justify-start px-3 py-2 text-sm text-white/90 transition-colors hover:bg-glass"
                    >
                      Feedback
                    </a> */}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Link
            href="/wch"
            aria-label="World Championship 2026"
            className={`ml-2 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold leading-[11px] transition-colors duration-200 ${
              router.pathname.startsWith('/wch')
                ? 'border-human-1/70 bg-human-4/30 text-white'
                : 'border-human-2/50 bg-human-4/15 text-human-1 hover:border-human-1/70 hover:bg-human-4/25 hover:text-white'
            }`}
          >
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute h-full w-full animate-ping rounded-full bg-human-1/60" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-human-1" />
            </span>
            <span className="flex flex-col items-center text-center">
              <span>WORLD</span>
              <span>CHAMPIONSHIP</span>
            </span>
          </Link>
        </div>
      </div>
      <div
        className={`hidden flex-row items-center md:flex ${isCompactDesktopNav ? 'gap-2' : 'gap-3'}`}
      >
        <ConnectButtonSlot />
        {discordLink}
        {user?.lichessId && (
          <LeaderboardNavBadge
            status={leaderboardStatus}
            loading={leaderboardLoading}
          />
        )}
        {notificationBell}
        {userInfo}
      </div>
    </div>
  )

  const mobileLayout = (
    <div className="flex w-full flex-row justify-between px-4">
      <Link href="/" passHref>
        <div className="flex flex-row items-center gap-2">
          <Image src={maiaLogo} width={40} height={40} alt="Maia Logo" />
          <h2 className="whitespace-nowrap text-2xl font-bold">Maia Chess</h2>
        </div>
      </Link>
      <div className="flex flex-row items-center gap-3">
        <ConnectButtonSlot />
        {/* Below 360px the title would wrap to make room; there Discord
            stays in the menu only. */}
        <span className="hidden min-[360px]:contents">{discordLink}</span>
        {notificationBell}
        <button
          aria-label="Open navigation menu"
          className="block cursor-pointer *:*:fill-primary"
          onClick={() => setShowMenu((show) => !show)}
        >
          <span className="material-symbols-outlined text-3xl">menu</span>
        </button>
      </div>
      {showMenu && (
        <div className="fixed left-0 top-0 z-40 flex h-screen w-screen flex-col items-start justify-between overflow-y-auto bg-backdrop py-4">
          <div className="flex w-full flex-row justify-between px-4">
            <Link href="/" passHref>
              <div className="flex flex-row items-center gap-2">
                <Image src={maiaLogo} width={40} height={40} alt="Maia Logo" />
                <h2 className="whitespace-nowrap text-2xl font-bold">
                  Maia Chess
                </h2>
              </div>
            </Link>
            <button
              aria-label="Close navigation menu"
              className="block cursor-pointer *:*:fill-primary"
              onClick={() => setShowMenu(false)}
            >
              <span className="material-symbols-outlined text-3xl">close</span>
            </button>
          </div>
          <div className="flex w-full flex-1 flex-col gap-5 overflow-y-auto px-12 py-6 tracking-wider">
            <Link
              href="/wch"
              onClick={() => setShowMenu(false)}
              className="flex items-center gap-2 font-semibold uppercase text-human-1"
            >
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-human-1" />
              World Championship
            </Link>
            <div className="flex flex-col items-start justify-center gap-3">
              <p>PLAY</p>
              <div className="ml-4 flex flex-col items-start justify-center gap-2">
                <button
                  onClick={() => {
                    setShowMenu(false)
                    startGame('againstMaia')
                  }}
                >
                  Play Maia
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false)
                    startGame('handAndBrain')
                  }}
                >
                  Play Hand and Brain
                </button>
                <a
                  href="https://lichess.org/@/maia1"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setShowMenu(false)}
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
            <Link href="/drills" className="uppercase">
              Drills
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
              Maia Blog
            </Link>
            <a
              target="_blank"
              rel="noreferrer"
              href={DISCORD_URL}
              className="uppercase"
              onClick={() => {
                trackCommunityLinkClicked('discord', 'mobile_menu')
                setShowMenu(false)
              }}
            >
              Discord
            </a>
            {/* <a
              target="_blank"
              rel="noreferrer"
              href="https://twitch.tv/maiachess"
              className="uppercase"
            >
              Watch
            </a> */}
            {/* <a
              target="_blank"
              rel="noreferrer"
              href="https://forms.gle/XYeoTJF4YgUu4Vq28"
              className="uppercase"
            >
              Feedback
            </a> */}
            {user?.lichessId ? (
              <>
                <Link href="/profile" className="uppercase">
                  Profile
                </Link>
                <Link href="/settings" className="uppercase">
                  Settings
                </Link>
                <button onClick={logout} className="text-left uppercase">
                  Log out
                </button>
              </>
            ) : (
              // Browser-kept settings, for visitors without an account too.
              <Link href="/settings" className="uppercase">
                Settings
              </Link>
            )}
          </div>
          <div className="flex w-full flex-row items-center gap-3 px-12">
            {user?.lichessId && (
              <LeaderboardNavBadge
                status={leaderboardStatus}
                loading={leaderboardLoading}
              />
            )}
            {user?.lichessId ? (
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl text-primary/80">
                  account_circle
                </span>
                <span className="text-lg font-medium tracking-wider text-primary/90">
                  {user?.displayName}
                </span>
              </div>
            ) : (
              <LichessSignInButton
                source="header_menu"
                className="px-4 py-2 text-base"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      <div
        data-component="app-header"
        className="flex w-full flex-row items-center justify-center pb-1 pt-4 md:pb-0"
      >
        {isMobile ? mobileLayout : desktopLayout}
      </div>
    </>
  )
}
