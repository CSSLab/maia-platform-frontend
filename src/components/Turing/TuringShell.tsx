import { useContext } from 'react'

import { TuringControllerContext } from 'src/contexts'
import { EmptyBoard } from 'src/components/Board/EmptyBoard'
import { GameInfo } from 'src/components/Common/GameInfo'
import { PageShell } from 'src/components/Common/PageShell'
import { BoardController } from 'src/components/Board/BoardController'
import { TuringSubmission } from 'src/components/Turing/TuringSubmission'

// The game's players, as the page shows them before a guess.
const Players = () => (
  <>
    <div className="flex w-full flex-col items-start justify-between text-secondary">
      <div className="flex w-full items-center justify-between gap-2 text-sm">
        <span>● Unknown</span>
      </div>
      <div className="flex w-full items-center justify-between gap-2 text-sm">
        <span>○ Unknown</span>
      </div>
    </div>
    <div className="invisible mt-2 text-center text-xs">
      <span className="font-semibold uppercase tracking-wider">draw</span>
    </div>
  </>
)

// The board controls as they are before a game has loaded (the context's
// defaults: no moves).
const Controls = () => {
  const controller = useContext(TuringControllerContext)
  return (
    <BoardController
      orientation={controller.orientation}
      setOrientation={controller.setOrientation}
      currentNode={controller.currentNode}
      plyCount={controller.plyCount}
      goToNode={controller.goToNode}
      goToNextNode={controller.goToNextNode}
      goToPreviousNode={controller.goToPreviousNode}
      goToRootNode={controller.goToRootNode}
      gameTree={controller.gameTree}
      embedded
    />
  )
}

const DesktopLayout = () => (
  <div className="flex h-full flex-1 flex-col justify-center gap-1 py-2">
    <div className="mx-auto mt-2 flex w-[90%] flex-row items-start justify-between gap-3">
      <div className="desktop-left-column-container flex flex-col justify-between">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
          <GameInfo title="Bot or Not" icon="smart_toy" type="turing" embedded>
            <Players />
          </GameInfo>
        </div>
      </div>
      <div className="relative flex aspect-square w-full max-w-[85vh] flex-shrink-0">
        <EmptyBoard />
      </div>
      <div className="flex h-[85vh] min-w-64 flex-grow flex-col">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
          <div className="relative bottom-0 min-h-[38px] flex-1 overflow-hidden" />
          <div className="border-t border-glass-border">
            <TuringSubmission rating={0} />
          </div>
          <div className="flex-none border-t border-glass-border">
            <Controls />
          </div>
        </div>
      </div>
    </div>
  </div>
)

const MobileLayout = () => (
  <div className="flex h-full flex-1 flex-col justify-center gap-1">
    <div className="mt-2 flex h-full flex-col items-start justify-start">
      <div className="flex h-auto w-full flex-col gap-2">
        <div className="w-screen">
          <GameInfo title="Bot or Not" icon="smart_toy" type="turing">
            <Players />
          </GameInfo>
        </div>
      </div>
      <div className="relative flex aspect-square h-[100vw] w-screen">
        <EmptyBoard />
      </div>
      <div className="flex h-auto w-full flex-col gap-2">
        <div className="flex w-full flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
          {/* The move list's row, as tall as the result it ends with. */}
          <div className="w-full px-2">
            <div className="invisible min-w-fit border-b border-t px-4 py-1 text-sm">
              draw
            </div>
          </div>
          <div className="border-t border-glass-border">
            <Controls />
          </div>
          <div className="w-full border-t border-glass-border">
            <TuringSubmission rating={0} />
          </div>
        </div>
      </div>
    </div>
  </div>
)

/**
 * Bot or Not's layout while its game loads: the panels, an empty board and
 * the guess form where the page will draw them, rendered on the server. The
 * page picks its phone or desktop layout in JavaScript (`isMobile`); the
 * shell picks it with CSS at the same width, so it is right before any
 * script has run.
 */
export const TuringShell: React.FC = () => (
  <PageShell
    desktopFrom={1025}
    desktopClassName="hidden min-[1025px]:block"
    mobileClassName="min-[1025px]:hidden"
    desktop={<DesktopLayout />}
    mobile={<MobileLayout />}
  />
)
