import { memo, useEffect, useMemo, useState } from 'react'
import { MovesByRatingArea } from './MovesByRatingArea'
import { analysisChartDrawn } from 'src/lib/analysisTiming'
import { ColorSanMapping } from 'src/types'
import { useContentStable } from 'src/hooks/useContentStable'

interface Props {
  moves: { [key: string]: number }[] | undefined
  colorSanMapping: ColorSanMapping
  isHomePage?: boolean
  positionKey?: string
  /** The rating chosen in the Maia menu: marked, with each move's share. */
  selectedRating?: number
}

/** The rating of a Maia model name (maia_kdd_1900 -> 1900). */
export const ratingOfModel = (model: string | undefined) => {
  const rating = parseInt((model ?? '').replace('maia_kdd_', ''), 10)
  return Number.isFinite(rating) ? rating : undefined
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
  selectedRating,
}: Props) => {
  const [shown, setShown] = useState({
    moves,
    colorSanMapping,
    positionKey,
    selectedRating,
  })
  if (
    moves?.length &&
    positionKey &&
    (moves !== shown.moves ||
      colorSanMapping !== shown.colorSanMapping ||
      positionKey !== shown.positionKey ||
      selectedRating !== shown.selectedRating)
  ) {
    // Set while rendering: React renders again before rendering the chart.
    setShown({
      moves,
      colorSanMapping,
      positionKey,
      selectedRating,
    })
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
      selectedRating={shown.selectedRating ?? selectedRating}
    />
  )
}

interface PlotProps {
  displayedMoves: Props['moves']
  moveKeys: string[]
  displayedColorSanMapping: ColorSanMapping
  isHomePage: boolean
  displayedPositionKey?: string
  selectedRating?: number
}

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
