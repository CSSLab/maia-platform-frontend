import { render } from '@testing-library/react'
import { MovesByRating } from './MovesByRating'

// Each AreaChart render is one chart redraw.
const charts: unknown[] = []
jest.mock('recharts', () => {
  const Empty = () => null
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return {
    Area: Empty,
    XAxis: Empty,
    YAxis: Empty,
    Legend: Empty,
    Tooltip: Empty,
    CartesianGrid: Empty,
    ResponsiveContainer: Pass,
    AreaChart: ({ data }: { data: unknown }) => {
      charts.push(data)
      return null
    },
  }
})

// MovesByRating loads the chart (MovesByRatingArea) with next/dynamic; here
// it renders at once.
jest.mock(
  'next/dynamic',
  () => () =>
    function MovesByRatingArea(props: Record<string, unknown>) {
      const { createElement } = jest.requireActual('react')
      const chart = jest.requireActual('./MovesByRatingArea')
      return createElement(chart.MovesByRatingArea, props)
    },
)

const moves = (e2e4: number) => [
  { rating: 600, e2e4, d2d4: 20 },
  { rating: 700, e2e4: e2e4 + 1, d2d4: 19 },
]
const colors = (e2e4Color: string, otherColor = '#111') => ({
  e2e4: { san: 'e4', color: e2e4Color },
  d2d4: { san: 'd4', color: '#222' },
  g1f3: { san: 'Nf3', color: otherColor },
})

beforeEach(() => {
  charts.length = 0
})

describe('MovesByRating', () => {
  it('draws new moves once', () => {
    const { rerender } = render(
      <MovesByRating
        moves={moves(30)}
        colorSanMapping={colors('#f00')}
        positionKey="a"
      />,
    )
    charts.length = 0
    const next = moves(40)
    rerender(
      <MovesByRating
        moves={next}
        colorSanMapping={colors('#f00')}
        positionKey="b"
      />,
    )
    expect(charts).toEqual([next])
  })

  it('keeps the last moves until the new position has some', () => {
    const first = moves(30)
    const { rerender } = render(
      <MovesByRating
        moves={first}
        colorSanMapping={colors('#f00')}
        positionKey="a"
      />,
    )
    charts.length = 0
    rerender(
      <MovesByRating
        moves={undefined}
        colorSanMapping={colors('#0f0', '#333')}
        positionKey="b"
      />,
    )
    expect(charts).toEqual([])
  })

  it('redraws for the colors of the moves it shows only', () => {
    const shown = moves(30)
    const { rerender } = render(
      <MovesByRating
        moves={shown}
        colorSanMapping={colors('#f00')}
        positionKey="a"
      />,
    )
    charts.length = 0
    rerender(
      <MovesByRating
        moves={shown}
        colorSanMapping={colors('#f00', '#333')}
        positionKey="a"
      />,
    )
    expect(charts).toEqual([])
    rerender(
      <MovesByRating
        moves={shown}
        colorSanMapping={colors('#0f0', '#333')}
        positionKey="a"
      />,
    )
    expect(charts).toEqual([shown])
  })
})
