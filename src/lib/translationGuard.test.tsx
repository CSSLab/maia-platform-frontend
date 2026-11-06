import { act, render } from '@testing-library/react'
import { useState } from 'react'
import { guardAgainstTranslation } from './translationGuard'

let toggle: () => void = () => undefined

// A conditional text node, as React renders "{x && 'text'}".
const Page = () => {
  const [shown, setShown] = useState(true)
  toggle = () => setShown((s) => !s)
  return (
    <p data-testid="p">
      {shown && 'Your move'}
      <span>e4</span>
    </p>
  )
}

// What a browser translator does: the text node goes into a <font>.
const translate = (p: HTMLElement) => {
  const text = p.firstChild as Text
  const font = document.createElement('font')
  font.appendChild(document.createTextNode('Tu jugada'))
  p.replaceChild(font, text)
}

describe('guardAgainstTranslation', () => {
  const { removeChild, insertBefore } = Node.prototype
  afterEach(() => {
    Node.prototype.removeChild = removeChild
    Node.prototype.insertBefore = insertBefore
    delete (Node.prototype as { __maiaTranslationGuard?: boolean })
      .__maiaTranslationGuard
  })

  it('without it, React fails on a translated page', () => {
    const { getByTestId } = render(<Page />)
    translate(getByTestId('p'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => act(() => toggle())).toThrow()
    spy.mockRestore()
  })

  it('with it, React carries on', () => {
    guardAgainstTranslation()
    const { getByTestId } = render(<Page />)
    translate(getByTestId('p'))
    expect(() => act(() => toggle())).not.toThrow()
    expect(() => act(() => toggle())).not.toThrow()
    expect(getByTestId('p').textContent).toContain('e4')
  })

  it('leaves normal removal and insertion as they were', () => {
    guardAgainstTranslation()
    const parent = document.createElement('div')
    const a = document.createElement('a')
    const b = document.createElement('b')
    parent.appendChild(b)
    parent.insertBefore(a, b)
    expect(parent.firstChild).toBe(a)
    parent.removeChild(a)
    expect(parent.firstChild).toBe(b)
  })
})
