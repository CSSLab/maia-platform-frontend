import { useMemo } from 'react'
import { Chess } from 'chess.ts'
import { useMotionValue } from 'framer-motion'

import { BlunderMeterResult, GameTree } from 'src/types'
import { ANALYSIS_LEFT_PANEL_TABS } from 'src/constants/analysis'
import { EmptyBoard } from 'src/components/Board/EmptyBoard'
import { BoardController } from 'src/components/Board/BoardController'
import { GameInfo } from 'src/components/Common/GameInfo'
import { PageShell } from 'src/components/Common/PageShell'
import { UnderlineTabs } from 'src/components/Common/UnderlineTabs'
import {
  AnalysisArrowLegend,
  AnalysisCompactBlunderMeter,
  AnalysisMaiaWinrateBar,
  AnalysisStockfishEvalBar,
} from 'src/components/Analysis/BoardChrome'

const EMPTY_BLUNDER_METER: BlunderMeterResult = {
  goodMoves: { moves: [], probability: 0 },
  okMoves: { moves: [], probability: 0 },
  blunderMoves: { moves: [], probability: 0 },
}

const noop = () => void 0

// The desktop board's size as the page sets it (desktopBoardSizeCss) once
// it has measured the strip above the board and the blunder meter below it
// (126 px together, before the engines report): the larger of
// min(42vw, 72vh) and the 85vh column less those and a 4 px gap, capped at
// 42vw, 46vw from 1280 px and 48vw from 1536 px.
const BOARD_SIZE =
  'max(min(42vw, 72vh), min(var(--analysis-board-cap), max(320px, calc(85vh - 130px))))'
const BOARD_MIN_SIZE = `max(24rem, ${BOARD_SIZE})`
// The win-rate and eval bars' columns beside the desktop board (wider from
// 1360 px).
const BOARD_ROW_COLUMNS =
  'var(--analysis-maia-gutter) minmax(0,1fr) var(--analysis-eval-gutter)'
const SIDEBAR_CONTENT_HEIGHT = 'calc(85vh - 9.5rem - 0.75rem)'

// The players' block, empty: as tall as the page's (two rows from md, one
// below).
const Players = () => (
  <div className="invisible flex w-full flex-col" aria-hidden>
    <div className="hidden md:block">
      <p className="text-sm">White</p>
      <p className="text-sm">Black</p>
    </div>
    <div className="flex w-full items-center text-xs md:hidden">
      <span className="font-medium">White</span>
    </div>
  </div>
)

const Controls = () => {
  const tree = useMemo(() => new GameTree(new Chess().fen()), [])
  return (
    <BoardController
      embedded
      gameTree={tree}
      orientation="white"
      setOrientation={noop}
      currentNode={tree.getRoot()}
      plyCount={0}
      goToNode={noop}
      goToNextNode={noop}
      goToPreviousNode={noop}
      goToRootNode={noop}
    />
  )
}

// The bars as the page shows them before the engines have reported.
const WinrateBar = (props: {
  variant: 'desktop' | 'mobile'
  desktopSize?: 'compact' | 'expanded'
}) => {
  const labelPositionTop = useMotionValue('50%')
  return (
    <AnalysisMaiaWinrateBar
      hasValue={false}
      displayText="--"
      labelPositionTop={labelPositionTop}
      {...props}
    />
  )
}

const EvalBar = (props: {
  variant: 'desktop' | 'mobile'
  desktopSize?: 'compact' | 'expanded'
}) => {
  const labelPositionTop = useMotionValue('50%')
  return (
    <AnalysisStockfishEvalBar
      hasEval={false}
      displayText="--"
      labelPositionTop={labelPositionTop}
      {...props}
    />
  )
}

// AnalysisSidebar's panel header, with analysis on.
const SidebarHeader = ({ variant }: { variant: 'desktop' | 'mobile' }) => (
  <div
    className={
      variant === 'desktop'
        ? 'flex h-10 min-h-10 items-center justify-between border-b border-glass-border bg-transparent px-4 text-white/90'
        : 'absolute left-0 top-0 z-10 flex h-10 min-h-10 w-full items-center justify-between border-b border-glass-border bg-transparent px-3 text-white/90 backdrop-blur-md'
    }
  >
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-xl text-white/80">
        analytics
      </span>
      <h3
        className={
          variant === 'desktop'
            ? 'font-semibold text-white'
            : 'text-sm font-semibold text-white'
        }
      >
        Analysis
      </h3>
    </div>
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 rounded-md border border-glass-border bg-glass px-2 py-1 text-xs text-white">
        <span className="material-symbols-outlined !text-xs text-white/80">
          visibility_off
        </span>
        <span className="text-white/90">Hide</span>
      </span>
    </div>
  </div>
)

const DesktopShell = () => (
  <div className="flex h-full w-full flex-col items-center py-4 2xl:items-end">
    <div className="flex h-full w-[92%] flex-row gap-4 [--analysis-board-cap:42vw] [--analysis-eval-gutter:54px] [--analysis-maia-gutter:58px] xl:w-[94%] xl:gap-5 xl:[--analysis-board-cap:46vw] min-[1360px]:[--analysis-eval-gutter:62px] min-[1360px]:[--analysis-maia-gutter:68px] 2xl:w-[97%] 2xl:[--analysis-board-cap:48vw]">
      <div className="desktop-left-column-container flex min-h-0 flex-col gap-2">
        <div className="w-full overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
          <GameInfo title="Analysis" icon="bar_chart" type="analysis" embedded>
            <Players />
          </GameInfo>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
          <UnderlineTabs
            tabs={ANALYSIS_LEFT_PANEL_TABS}
            selected="moves"
            onSelect={noop}
            layoutId="analysisShellLeftPanelTab"
            tabClassName="outline-none focus:outline-none focus-visible:outline-none"
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" />
          <Controls />
        </div>
      </div>
      <div
        className="desktop-middle-column-container flex flex-col gap-3"
        style={{ width: BOARD_SIZE, minWidth: BOARD_MIN_SIZE, height: '85vh' }}
      >
        <div className="flex h-full w-full flex-col overflow-visible">
          <div
            className="desktop-board-container relative flex shrink-0"
            style={{
              width: BOARD_SIZE,
              minWidth: BOARD_MIN_SIZE,
              height: 'auto',
              minHeight: 0,
            }}
          >
            <div className="flex w-full flex-col gap-1">
              <div
                className="grid w-full items-center gap-1.5 py-1.5 pr-1"
                style={{ gridTemplateColumns: BOARD_ROW_COLUMNS }}
              >
                <div className="pointer-events-none relative flex justify-center">
                  <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold leading-none text-human-2">
                    White Win %
                  </span>
                </div>
                <div className="pointer-events-none relative flex min-w-0 items-center justify-center">
                  <AnalysisArrowLegend
                    labelMode="short"
                    className="gap-x-3 text-[10px]"
                  />
                </div>
                <div className="pointer-events-none flex justify-center">
                  <span className="text-[10px] font-semibold leading-none text-engine-2">
                    SF Eval
                  </span>
                </div>
              </div>
              <div
                className="grid w-full items-stretch gap-1.5 pr-1"
                style={{ gridTemplateColumns: BOARD_ROW_COLUMNS }}
              >
                <div className="pointer-events-none flex justify-center py-1">
                  <div className="contents min-[1360px]:hidden">
                    <WinrateBar variant="desktop" desktopSize="compact" />
                  </div>
                  <div className="hidden min-[1360px]:contents">
                    <WinrateBar variant="desktop" desktopSize="expanded" />
                  </div>
                </div>
                <div className="relative flex aspect-square w-full">
                  <EmptyBoard />
                </div>
                <div className="pointer-events-none flex justify-center py-1">
                  <div className="contents min-[1360px]:hidden">
                    <EvalBar variant="desktop" desktopSize="compact" />
                  </div>
                  <div className="hidden min-[1360px]:contents">
                    <EvalBar variant="desktop" desktopSize="expanded" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="shrink-0 pt-3">
            <AnalysisCompactBlunderMeter
              variant="desktop"
              data={EMPTY_BLUNDER_METER}
              maiaHeaderLabel={'Maia %\n@ ----'}
              hover={noop}
              makeMove={noop}
            />
          </div>
        </div>
      </div>
      <div
        className="desktop-right-column-container flex flex-col gap-3"
        style={{
          width: 'clamp(23rem, 27vw, 26rem)',
          minWidth: '23rem',
          flexBasis: 'clamp(23rem, 27vw, 26rem)',
        }}
      >
        <div className="min-h-0 flex-1">
          <div className="hidden xl:flex xl:h-full xl:flex-col xl:gap-3">
            <div
              className="relative flex gap-3"
              style={{
                height: `calc((${SIDEBAR_CONTENT_HEIGHT} - 0.75rem) / 2)`,
              }}
            >
              <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-glass-border bg-glass-strong backdrop-blur-md">
                <SidebarHeader variant="desktop" />
              </div>
            </div>
            <div
              className="relative flex flex-row gap-3"
              style={{
                height: `calc((${SIDEBAR_CONTENT_HEIGHT} - 0.75rem) / 2)`,
              }}
            >
              <div className="relative flex h-full w-full flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md" />
            </div>
          </div>
          <div className="flex h-full flex-col gap-3 xl:hidden">
            <div className="desktop-analysis-small-row-1-container relative flex overflow-hidden rounded-md border border-glass-border bg-glass-strong pt-10 backdrop-blur-md">
              <SidebarHeader variant="mobile" />
            </div>
            <div className="desktop-analysis-small-row-2-container relative flex w-full">
              <div className="relative flex h-full w-full flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md" />
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <div
            className="flex h-full min-h-0 flex-col overflow-hidden"
            style={{ height: '9.5rem' }}
          />
        </div>
      </div>
    </div>
  </div>
)

const MobileShell = () => (
  <div className="flex h-full flex-1 flex-col justify-center gap-1">
    <div className="flex w-full flex-col items-start justify-start">
      <GameInfo
        title="Analysis"
        icon="bar_chart"
        type="analysis"
        showGameListButton
        onGameListClick={noop}
        mobileActions={
          <span className="flex items-center gap-1 rounded bg-human-4/30 px-2 py-1 text-xxs text-human-2 md:hidden md:text-sm">
            <span className="material-symbols-outlined text-xxs md:text-sm">
              visibility_off
            </span>
            <span>Hide</span>
          </span>
        }
      >
        <Players />
      </GameInfo>
      <div className="flex w-full flex-col items-center px-3">
        <div className="pointer-events-none mb-0.5 grid h-5 w-full max-w-[560px] grid-cols-[30px_minmax(0,1fr)_30px] items-center gap-3">
          <div className="flex justify-center">
            <span className="translate-y-px whitespace-nowrap text-[8px] font-extrabold leading-none text-human-2">
              Maia %
            </span>
          </div>
          <div className="relative flex min-w-0 items-center justify-center">
            <AnalysisArrowLegend
              labelMode="short"
              className="translate-y-px justify-center gap-x-3 self-center text-[8px] font-semibold"
            />
          </div>
          <div className="flex justify-center">
            <span className="translate-y-px whitespace-nowrap text-[8px] font-extrabold leading-none text-engine-2">
              SF Eval
            </span>
          </div>
        </div>
        <div className="grid w-full max-w-[560px] grid-cols-[30px_minmax(0,1fr)_30px] items-stretch gap-3">
          <div className="pointer-events-none flex min-h-0 min-w-0 justify-center self-stretch">
            <WinrateBar variant="mobile" />
          </div>
          <div className="relative flex aspect-square w-full">
            <EmptyBoard />
          </div>
          <div className="pointer-events-none flex min-h-0 min-w-0 justify-center self-stretch">
            <EvalBar variant="mobile" />
          </div>
        </div>
        <AnalysisCompactBlunderMeter
          className="mb-1.5 mt-3 w-full max-w-[560px]"
          data={EMPTY_BLUNDER_METER}
          hover={noop}
          makeMove={noop}
        />
      </div>
      <div className="flex w-full flex-col gap-0">
        <div className="w-full !flex-grow-0">
          <Controls />
        </div>
      </div>
    </div>
  </div>
)

/**
 * The analysis page's layout while the visitor's session and the game load:
 * the panels, the board with its bars and an empty board where the page
 * will draw them, rendered on the server. The page picks its phone-style or
 * desktop layout in JavaScript (desktop above 1120 px); the shell picks it
 * with CSS at the same width, so it is right before any script has run.
 */
export const AnalysisShell: React.FC = () => (
  <PageShell
    desktopFrom={1121}
    desktopClassName="hidden min-[1121px]:block"
    mobileClassName="min-[1121px]:hidden"
    desktop={<DesktopShell />}
    mobile={<MobileShell />}
  />
)
