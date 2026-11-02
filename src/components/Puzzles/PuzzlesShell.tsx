import { EmptyBoard } from 'src/components/Board/EmptyBoard'
import { GameInfo } from 'src/components/Common/GameInfo'
import { PageShell } from 'src/components/Common/PageShell'

// The desktop board's size as the page first sets it (desktopBoardSizeCss,
// with the board controller's default height): the larger of min(42vw, 72vh)
// and the 85vh column less the controller and gaps, capped at 42vw, 46vw
// from 1280 px and 48vw from 1536 px.
const BOARD_SIZE =
  'max(min(42vw, 72vh), min(var(--puzzle-board-cap), max(340px, calc(85vh - 84px))))'
const BOARD_MIN_SIZE = `max(24rem, ${BOARD_SIZE})`

const DesktopLayout = () => (
  <div className="flex h-full w-full flex-col items-center py-4">
    <div className="flex h-full w-[92%] flex-row gap-4 [--puzzle-board-cap:42vw] xl:w-[94%] xl:gap-5 xl:[--puzzle-board-cap:46vw] 2xl:w-[97%] 2xl:[--puzzle-board-cap:48vw]">
      <div className="desktop-left-column-container flex min-h-0 flex-col gap-2">
        <div className="w-full overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
          <GameInfo title="Puzzles" icon="target" type="train" embedded>
            <div className="flex w-full flex-col justify-start text-sm text-secondary 2xl:text-base">
              <span>Puzzle</span>
              <span>
                Rating: <span className="text-secondary/60">hidden</span>
              </span>
            </div>
          </GameInfo>
        </div>
      </div>
      <div
        className="desktop-middle-column-container flex flex-col gap-2"
        style={{
          width: BOARD_SIZE,
          minWidth: BOARD_MIN_SIZE,
          height: '85vh',
        }}
      >
        <div
          className="desktop-board-container relative flex aspect-square"
          style={{
            width: BOARD_SIZE,
            minWidth: BOARD_MIN_SIZE,
            height: BOARD_SIZE,
            minHeight: BOARD_MIN_SIZE,
          }}
        >
          <EmptyBoard />
        </div>
      </div>
    </div>
  </div>
)

const MobileLayout = () => (
  <div className="flex h-full flex-1 flex-col justify-center gap-1">
    <div className="mt-2 flex h-full flex-col items-start justify-start gap-1">
      <div className="flex h-auto w-full flex-col">
        <GameInfo title="Puzzles" icon="target" type="train">
          <div className="flex w-full items-center justify-between text-secondary">
            <span>Puzzle</span>
            <span>
              Rating: <span className="text-secondary/60">hidden</span>
            </span>
          </div>
        </GameInfo>
      </div>
      <div className="relative flex aspect-square h-[100vw] w-screen">
        <EmptyBoard />
      </div>
    </div>
  </div>
)

/**
 * The puzzles page's layout while the visitor's session and puzzle load: the
 * panels and an empty board where the page will draw them, rendered on the
 * server. The page picks its phone or desktop layout in JavaScript
 * (`isMobile`); the shell picks it with CSS at the same width, so it is right
 * before any script has run.
 */
export const PuzzlesShell: React.FC = () => (
  <PageShell
    desktopFrom={1025}
    desktopClassName="hidden min-[1025px]:block"
    mobileClassName="min-[1025px]:hidden"
    desktop={<DesktopLayout />}
    mobile={<MobileLayout />}
  />
)
