import { fireEvent, render } from '@testing-library/react'

import { WindowSizeContext } from 'src/contexts'
import type { TablebaseResult } from 'src/lib/tablebase'
import { TablebasePanel } from './TablebasePanel'

const RESULT: TablebaseResult = {
  fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
  category: 'win',
  dtm: 43,
  dtz: 9,
  checkmate: false,
  stalemate: false,
  moves: [
    {
      uci: 'e1d2',
      san: 'Kd2',
      category: 'win',
      dtm: 43,
      dtz: -8,
      checkmate: false,
      stalemate: false,
    },
    {
      uci: 'e2e3',
      san: 'e3',
      category: 'draw',
      dtm: null,
      dtz: 0,
      checkmate: false,
      stalemate: false,
    },
  ],
}

const renderPanel = (isMobile: boolean) => {
  const hover = jest.fn()
  const makeMove = jest.fn()
  const utils = render(
    <WindowSizeContext.Provider value={{ width: 1000, height: 800, isMobile }}>
      <TablebasePanel result={RESULT} hover={hover} makeMove={makeMove} />
    </WindowSizeContext.Provider>,
  )
  return { ...utils, hover, makeMove }
}

describe('TablebasePanel', () => {
  it("shows the position's result and its moves", () => {
    const { getByText } = renderPanel(false)
    expect(getByText('Win · mate in 22')).toBeInTheDocument()
    expect(getByText('Win #22')).toBeInTheDocument()
    expect(getByText('Draw')).toBeInTheDocument()
  })

  it('previews a move on hover and plays it on click', () => {
    const { getByText, hover, makeMove } = renderPanel(false)
    fireEvent.mouseEnter(getByText('Kd2').closest('button')!)
    expect(hover).toHaveBeenLastCalledWith('e1d2')
    fireEvent.click(getByText('Kd2'))
    expect(makeMove).toHaveBeenCalledWith('e1d2')
  })

  it('on phones, plays a move on the second tap', () => {
    const { getByText, hover, makeMove } = renderPanel(true)
    fireEvent.click(getByText('e3'))
    expect(hover).toHaveBeenLastCalledWith('e2e3')
    expect(makeMove).not.toHaveBeenCalled()
    fireEvent.click(getByText('e3'))
    expect(makeMove).toHaveBeenCalledWith('e2e3')
  })
})
