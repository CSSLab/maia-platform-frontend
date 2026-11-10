import { act, render, screen } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
// The build Next renders pages with (jsdom would pick the browser's).
import { renderToString } from 'react-dom/server.node'

import { TimeAgo } from './TimeAgo'
import { formatAbsoluteTime } from 'src/lib/relativeTime'

const NOW = Date.UTC(2026, 10, 10, 12, 0, 0)
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(NOW)
})

afterEach(() => {
  jest.useRealTimers()
})

describe('TimeAgo', () => {
  it('writes how long ago a time was, with the date in the tooltip', () => {
    const { container } = render(<TimeAgo time="2026-11-07T11:00:00.000000" />)

    const time = container.querySelector('time')
    expect(time).toHaveTextContent(/^3 days ago$/)
    // The zone-less backend time, read as UTC.
    expect(time).toHaveAttribute('datetime', '2026-11-07T11:00:00.000Z')
    expect(time).toHaveAttribute(
      'title',
      formatAbsoluteTime('2026-11-07T11:00:00Z'),
    )
  })

  it('reads a time with a zone and epoch milliseconds the same', () => {
    render(
      <>
        <TimeAgo time="2026-11-10T09:00:00.000Z" />
        <TimeAgo time={NOW - 3 * HOUR} />
        <TimeAgo time="2026-11-10 09:00:00.000000" />
      </>,
    )
    expect(screen.getAllByText('3 hours ago')).toHaveLength(3)
  })

  it('writes the short form, and says it in words in the tooltip', () => {
    const { container } = render(
      <TimeAgo time={NOW - 3 * DAY} format="compact" className="muted" />,
    )

    const time = container.querySelector('time')
    expect(time).toHaveTextContent(/^3d$/)
    expect(time).toHaveClass('muted')
    expect(time?.title).toBe(
      `3 days ago · ${formatAbsoluteTime(NOW - 3 * DAY)}`,
    )
  })

  it('renders both forms for a width to choose between', () => {
    const { container } = render(
      <TimeAgo time={NOW - 14 * DAY} format="responsive" />,
    )

    const [short, long] = Array.from(container.querySelectorAll('time span'))
    expect(short).toHaveTextContent(/^2w$/)
    expect(short).toHaveClass('md:hidden')
    expect(long).toHaveTextContent(/^2 weeks ago$/)
    expect(long).toHaveClass('hidden', 'md:inline')
  })

  it('writes a prefix before the time', () => {
    const { container } = render(
      <TimeAgo time={NOW - 5 * MINUTE} prefix="Last played " />,
    )
    expect(container).toHaveTextContent(/^Last played 5 minutes ago$/)
  })

  it('names the span to an end time in the tooltip', () => {
    const start = NOW - HOUR
    const end = NOW - 40 * MINUTE
    const { container } = render(<TimeAgo time={start} end={end} />)
    expect(container.querySelector('time')?.title).toBe(
      formatAbsoluteTime(start, { end }),
    )
    expect(container).toHaveTextContent(/^1 hour ago$/)
  })

  it.each([
    ['no time', undefined],
    ['null', null],
    ['an empty time', ''],
    ['a time that is not a date', '????.??.??'],
    ['a time in the future', NOW + DAY],
  ])('renders nothing for %s', (_, time) => {
    const { container } = render(<TimeAgo time={time} prefix="Played " />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a fallback in place of a time it can’t show', () => {
    const { container, rerender } = render(
      <TimeAgo time="????.??.??" fallback={<p>7</p>} />,
    )
    expect(container).toHaveTextContent(/^7$/)
    expect(container.querySelector('time')).toBeNull()

    rerender(<TimeAgo time={NOW - DAY} format="compact" fallback={<p>7</p>} />)
    expect(container).toHaveTextContent(/^1d$/)
  })

  it('moves on as time passes', () => {
    const { container } = render(<TimeAgo time={NOW - 59 * MINUTE} />)
    expect(container).toHaveTextContent('59 minutes ago')

    act(() => {
      jest.advanceTimersByTime(MINUTE)
    })
    expect(container).toHaveTextContent('1 hour ago')

    act(() => {
      jest.advanceTimersByTime(HOUR)
    })
    expect(container).toHaveTextContent('2 hours ago')
  })

  it('stops its clock when the last time leaves the page', () => {
    const first = render(<TimeAgo time={NOW - HOUR} />)
    const second = render(<TimeAgo time={NOW - DAY} />)
    expect(jest.getTimerCount()).toBe(1)

    first.unmount()
    expect(jest.getTimerCount()).toBe(1)
    second.unmount()
    expect(jest.getTimerCount()).toBe(0)
  })

  it('is left out of the server’s HTML and appears without a mismatch', () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    const ui = (
      <p>
        Played <TimeAgo time={NOW - 2 * DAY} />
      </p>
    )

    // The server's clock, locale and zone aren't the reader's.
    const html = renderToString(ui)
    expect(html).not.toContain('<time')
    expect(html).not.toContain('ago')

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    let root: ReturnType<typeof hydrateRoot>
    act(() => {
      root = hydrateRoot(container, ui, {
        onRecoverableError: (error) => console.error(error),
      })
    })

    expect(container).toHaveTextContent('Played 2 days ago')
    expect(errors).not.toHaveBeenCalled()

    act(() => root.unmount())
    container.remove()
    errors.mockRestore()
  })
})
