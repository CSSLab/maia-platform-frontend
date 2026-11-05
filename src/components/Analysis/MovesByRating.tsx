import dynamic from 'next/dynamic'
import { memo, useEffect, useMemo, useState } from 'react'
import { analysisChartDrawn } from 'src/lib/analysisTiming'
import { ColorSanMapping } from 'src/types'
import { useContentStable } from 'src/hooks/useContentStable'

interface Props {
  moves: { [key: string]: number }[] | undefined
  colorSanMapping: ColorSanMapping
  isHomePage?: boolean
  positionKey?: string
}

/**
 * Keeps showing the last position's moves until the new position's arrive
 * (`positionKey`), and redraws the chart only when what it shows changes. The
 * analysis page re-renders on every engine update, and Stockfish's changing
 * evaluations recolor moves the chart does not show; a phone took 16-26
 * chart renders per move (each update drew twice, through an effect).
 */
const MovesByRatingChart: React.FC<Props> = ({
  moves,
  colorSanMapping,
  isHomePage = false,
  positionKey,
}: Props) => {
  const [shown, setShown] = useState({ moves, colorSanMapping, positionKey })
  if (
    moves?.length &&
    positionKey &&
    (moves !== shown.moves ||
      colorSanMapping !== shown.colorSanMapping ||
      positionKey !== shown.positionKey)
  ) {
    // Set while rendering: React renders again before rendering the chart.
    setShown({ moves, colorSanMapping, positionKey })
  }

  useEffect(() => {
    if (shown.moves?.length) analysisChartDrawn(shown.positionKey)
  }, [shown])

  const moveKeys = useMemo(() => {
    if (!shown.moves?.length) return []
    return Object.keys(shown.moves[0]).filter((move) => move !== 'rating')
  }, [shown.moves])

  const shownColorSanMapping = useContentStable(
    useMemo(
      () =>
        Object.fromEntries(
          moveKeys
            .filter((move) => shown.colorSanMapping[move])
            .map((move) => [move, shown.colorSanMapping[move]]),
        ),
      [moveKeys, shown.colorSanMapping],
    ),
  )

  return (
    <MovesByRatingPlot
      displayedMoves={shown.moves}
      moveKeys={moveKeys}
      displayedColorSanMapping={shownColorSanMapping}
      isHomePage={isHomePage}
      displayedPositionKey={shown.positionKey}
    />
  )
}

interface PlotProps {
  displayedMoves: Props['moves']
  moveKeys: string[]
  displayedColorSanMapping: ColorSanMapping
  isHomePage: boolean
  displayedPositionKey?: string
}

// The chart (recharts, ~320 KB of JavaScript) loads in its own chunk once
// the page has rendered, so pages draw their game before it; the panel and
// its heading draw at once, and the chart fills its place.
const MovesByRatingArea = dynamic(
  () => import('./MovesByRatingArea').then((mod) => mod.MovesByRatingArea),
  { ssr: false, loading: () => <div className="h-[90%] w-full" /> },
)

const MovesByRatingPlot = memo(function MovesByRatingPlot(props: PlotProps) {
  return (
    <div
      id="analysis-moves-by-rating"
      className="flex h-64 w-full flex-col bg-transparent md:h-full md:rounded"
    >
      <h2 className="p-3 text-base text-primary md:text-sm xl:text-base">
        Moves by Rating
      </h2>
      <MovesByRatingArea {...props} />
    </div>
  )
})

// Re-renders only when its props change: the analysis page re-renders on
// every engine update, and each chart render takes tens of milliseconds.
export const MovesByRating = memo(MovesByRatingChart)
