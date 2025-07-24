import { render, screen } from '@testing-library/react'
import { MovesByRating } from '../../src/components/Analysis/MovesByRating'
import { WindowSizeContext } from '../../src/contexts'

// Mock recharts
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children, data, margin }: any) => (
    <div
      data-testid="area-chart"
      data-chart-data={JSON.stringify(data)}
      data-margin={JSON.stringify(margin)}
    >
      {children}
    </div>
  ),
  Area: ({ dataKey, stroke, fill, name, strokeWidth, dot }: any) => (
    <div
      data-testid={`area-${dataKey}`}
      data-stroke={stroke}
      data-fill={fill}
      data-name={name}
      data-stroke-width={strokeWidth}
      data-dot={JSON.stringify(dot)}
    />
  ),
  XAxis: ({ dataKey, ticks, tick }: any) => (
    <div
      data-testid="x-axis"
      data-key={dataKey}
      data-ticks={JSON.stringify(ticks)}
      data-tick={JSON.stringify(tick)}
    />
  ),
  YAxis: ({ yAxisId, domain, tick, label, tickFormatter }: any) => (
    <div
      data-testid={`y-axis-${yAxisId}`}
      data-domain={JSON.stringify(domain)}
      data-tick={JSON.stringify(tick)}
      data-label={JSON.stringify(label)}
      data-tick-formatter={tickFormatter?.toString()}
    />
  ),
  CartesianGrid: ({ strokeDasharray, stroke }: any) => (
    <div
      data-testid="cartesian-grid"
      data-stroke-dasharray={strokeDasharray}
      data-stroke={stroke}
    />
  ),
  Tooltip: ({ content }: any) => (
    <div data-testid="tooltip">
      {/* Mock tooltip content for testing */}
      {content && typeof content === 'function' && (
        <div>
          {content({
            payload: [
              {
                name: 'e4',
                value: 45,
                color: '#ffffff',
                payload: { rating: 1500 },
              },
              {
                name: 'd4',
                value: 30,
                color: '#ff0000',
                payload: { rating: 1500 },
              },
            ],
          })}
        </div>
      )}
    </div>
  ),
  Legend: ({ formatter }: any) => (
    <div data-testid="legend">
      {formatter && (
        <div>
          <span>{formatter('e4')}</span>
          <span>{formatter('d4')}</span>
        </div>
      )}
    </div>
  ),
}))

describe('MovesByRating', () => {
  const mockMoves = [
    { rating: 1100, e4: 30, d4: 20, Nf3: 15 },
    { rating: 1300, e4: 35, d4: 25, Nf3: 18 },
    { rating: 1500, e4: 45, d4: 30, Nf3: 20 },
    { rating: 1700, e4: 50, d4: 35, Nf3: 25 },
    { rating: 1900, e4: 55, d4: 40, Nf3: 30 },
  ]

  const mockColorSanMapping = {
    e4: { san: 'e4', color: '#ffffff' },
    d4: { san: 'd4', color: '#ff0000' },
    Nf3: { san: 'Nf3', color: '#00ff00' },
  }

  const renderWithWindowSize = (isMobile = false, props = {}) => {
    const windowSizeContext = {
      isMobile,
      windowSize: {
        width: isMobile ? 375 : 1024,
        height: isMobile ? 667 : 768,
      },
    }

    const defaultProps = {
      moves: mockMoves,
      colorSanMapping: mockColorSanMapping,
      ...props,
    }

    return render(
      <WindowSizeContext.Provider value={windowSizeContext}>
        <MovesByRating {...defaultProps} />
      </WindowSizeContext.Provider>,
    )
  }

  it('should render component title', () => {
    renderWithWindowSize()

    expect(screen.getByText('Moves by Rating')).toBeInTheDocument()
  })

  it('should render ResponsiveContainer and AreaChart', () => {
    renderWithWindowSize()

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
  })

  it('should pass moves data to AreaChart', () => {
    renderWithWindowSize()

    const areaChart = screen.getByTestId('area-chart')
    const chartData = JSON.parse(
      areaChart.getAttribute('data-chart-data') || '[]',
    )
    expect(chartData).toEqual(mockMoves)
  })

  it('should render Area components for each move', () => {
    renderWithWindowSize()

    expect(screen.getByTestId('area-e4')).toBeInTheDocument()
    expect(screen.getByTestId('area-d4')).toBeInTheDocument()
    expect(screen.getByTestId('area-Nf3')).toBeInTheDocument()
  })

  it('should apply correct colors to Area components', () => {
    renderWithWindowSize()

    const e4Area = screen.getByTestId('area-e4')
    const d4Area = screen.getByTestId('area-d4')
    const nf3Area = screen.getByTestId('area-Nf3')

    expect(e4Area).toHaveAttribute('data-stroke', '#ffffff')
    expect(d4Area).toHaveAttribute('data-stroke', '#ff0000')
    expect(nf3Area).toHaveAttribute('data-stroke', '#00ff00')
  })

  it('should use SAN notation for Area names', () => {
    renderWithWindowSize()

    const e4Area = screen.getByTestId('area-e4')
    const d4Area = screen.getByTestId('area-d4')
    const nf3Area = screen.getByTestId('area-Nf3')

    expect(e4Area).toHaveAttribute('data-name', 'e4')
    expect(d4Area).toHaveAttribute('data-name', 'd4')
    expect(nf3Area).toHaveAttribute('data-name', 'Nf3')
  })

  describe('Responsive behavior', () => {
    it('should use mobile ticks on mobile', () => {
      renderWithWindowSize(true)

      const xAxis = screen.getByTestId('x-axis')
      const ticks = JSON.parse(xAxis.getAttribute('data-ticks') || '[]')
      expect(ticks).toEqual([1100, 1300, 1500, 1700, 1900])
    })

    it('should use desktop ticks on desktop', () => {
      renderWithWindowSize(false)

      const xAxis = screen.getByTestId('x-axis')
      const ticks = JSON.parse(xAxis.getAttribute('data-ticks') || '[]')
      expect(ticks).toEqual([
        1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900,
      ])
    })

    it('should use smaller stroke width on mobile', () => {
      renderWithWindowSize(true)

      const e4Area = screen.getByTestId('area-e4')
      expect(e4Area).toHaveAttribute('data-stroke-width', '2')
    })

    it('should use larger stroke width on desktop', () => {
      renderWithWindowSize(false)

      const e4Area = screen.getByTestId('area-e4')
      expect(e4Area).toHaveAttribute('data-stroke-width', '3')
    })

    it('should use smaller dots on mobile', () => {
      renderWithWindowSize(true)

      const e4Area = screen.getByTestId('area-e4')
      const dot = JSON.parse(e4Area.getAttribute('data-dot') || '{}')
      expect(dot.r).toBe(2)
      expect(dot.strokeWidth).toBe(2)
    })

    it('should use larger dots on desktop', () => {
      renderWithWindowSize(false)

      const e4Area = screen.getByTestId('area-e4')
      const dot = JSON.parse(e4Area.getAttribute('data-dot') || '{}')
      expect(dot.r).toBe(3)
      expect(dot.strokeWidth).toBe(3)
    })
  })

  describe('Domain calculation', () => {
    it('should use domain max of 60 for small values', () => {
      const smallValueMoves = [{ rating: 1500, e4: 30, d4: 20 }]
      renderWithWindowSize(false, { moves: smallValueMoves })

      const yAxis = screen.getByTestId('y-axis-left')
      const domain = JSON.parse(yAxis.getAttribute('data-domain') || '[]')
      expect(domain).toEqual([0, 60])
    })

    it('should use domain max of 100 for large values', () => {
      const largeValueMoves = [{ rating: 1500, e4: 80, d4: 70 }]
      renderWithWindowSize(false, { moves: largeValueMoves })

      const yAxis = screen.getByTestId('y-axis-left')
      const domain = JSON.parse(yAxis.getAttribute('data-domain') || '[]')
      expect(domain).toEqual([0, 100])
    })

    it('should handle undefined moves gracefully', () => {
      renderWithWindowSize(false, { moves: undefined })

      const yAxis = screen.getByTestId('y-axis-left')
      const domain = JSON.parse(yAxis.getAttribute('data-domain') || '[]')
      expect(domain).toEqual([0, 100]) // Default to 100 when no moves (maxValue=100 when moves undefined)
    })
  })

  describe('Chart configuration', () => {
    it('should configure XAxis with rating dataKey', () => {
      renderWithWindowSize()

      const xAxis = screen.getByTestId('x-axis')
      expect(xAxis).toHaveAttribute('data-key', 'rating')
    })

    it('should configure YAxis with percentage formatter', () => {
      renderWithWindowSize()

      const yAxis = screen.getByTestId('y-axis-left')
      const tickFormatter = yAxis.getAttribute('data-tick-formatter')
      expect(tickFormatter).toContain('value') // Check if formatter function is present
    })

    it('should set correct Y-axis label for home page', () => {
      renderWithWindowSize(false, { isHomePage: true })

      const yAxis = screen.getByTestId('y-axis-left')
      const label = JSON.parse(yAxis.getAttribute('data-label') || '{}')
      expect(label.fontSize).toBe(12)
    })

    it('should set correct Y-axis label for analysis page', () => {
      renderWithWindowSize(false, { isHomePage: false })

      const yAxis = screen.getByTestId('y-axis-left')
      const label = JSON.parse(yAxis.getAttribute('data-label') || '{}')
      expect(label.fontSize).toBe(14)
    })
  })

  describe('Tooltip functionality', () => {
    it('should render tooltip with move data', () => {
      renderWithWindowSize()

      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
      expect(screen.getByText('1500')).toBeInTheDocument() // Rating
      expect(screen.getAllByText('e4')).toHaveLength(2) // Move appears in both tooltip and legend
      expect(screen.getByText('45%')).toBeInTheDocument() // Probability
    })
  })

  describe('Legend functionality', () => {
    it('should render legend with SAN notation', () => {
      renderWithWindowSize()

      expect(screen.getByTestId('legend')).toBeInTheDocument()
      // The legend formatter should use SAN notation from colorSanMapping
    })
  })

  describe('Color mapping', () => {
    it('should handle missing color mapping gracefully', () => {
      const incompleteColorSanMapping = {
        e4: { san: 'e4', color: '#ffffff' },
        // Missing d4 and Nf3
      }

      renderWithWindowSize(false, {
        colorSanMapping: incompleteColorSanMapping,
      })

      const d4Area = screen.getByTestId('area-d4')
      const nf3Area = screen.getByTestId('area-Nf3')

      expect(d4Area).toHaveAttribute('data-stroke', '#fff') // Default fallback
      expect(nf3Area).toHaveAttribute('data-stroke', '#fff') // Default fallback
    })

    it('should handle missing SAN mapping gracefully', () => {
      const incompleteSanMapping = {
        e4: { san: 'e4', color: '#ffffff' },
        d4: { color: '#ff0000' }, // Missing san
      }

      renderWithWindowSize(false, {
        colorSanMapping: incompleteSanMapping as any,
      })

      const d4Area = screen.getByTestId('area-d4')
      expect(d4Area).toHaveAttribute('data-name', 'd4') // Falls back to move key
    })
  })

  describe('Empty states', () => {
    it('should handle empty moves array', () => {
      renderWithWindowSize(false, { moves: [] })

      expect(screen.getByText('Moves by Rating')).toBeInTheDocument()
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('should handle moves with only rating', () => {
      const onlyRatingMoves = [{ rating: 1500 }]

      renderWithWindowSize(false, { moves: onlyRatingMoves })

      expect(screen.getByText('Moves by Rating')).toBeInTheDocument()
      // Should not crash, though no areas will be rendered
    })
  })

  describe('Styling and layout', () => {
    it('should have correct container classes', () => {
      renderWithWindowSize()

      const container = screen.getByText('Moves by Rating').closest('div')
      expect(container).toHaveClass(
        'flex',
        'h-64',
        'w-full',
        'flex-col',
        'bg-background-1/60',
      )
    })

    it('should set correct chart margins for mobile', () => {
      renderWithWindowSize(true)

      const areaChart = screen.getByTestId('area-chart')
      const margin = JSON.parse(areaChart.getAttribute('data-margin') || '{}')
      expect(margin.right).toBe(40)
      expect(margin.top).toBe(5)
    })

    it('should set correct chart margins for desktop', () => {
      renderWithWindowSize(false)

      const areaChart = screen.getByTestId('area-chart')
      const margin = JSON.parse(areaChart.getAttribute('data-margin') || '{}')
      expect(margin.right).toBe(50)
      expect(margin.top).toBe(0)
    })
  })
})
