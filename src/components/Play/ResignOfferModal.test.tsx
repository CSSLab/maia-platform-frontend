import { fireEvent, render, screen } from '@testing-library/react'
import { ResignOfferModal } from './ResignOfferModal'

const modal = (
  fields: Partial<Parameters<typeof ResignOfferModal>[0]> = {},
) => {
  const props = {
    isOpen: true,
    answering: false,
    onAccept: jest.fn(),
    onPlayOn: jest.fn(),
    ...fields,
  }
  render(<ResignOfferModal {...props} />)
  return props
}

describe('ResignOfferModal', () => {
  it('shows nothing without an offer', () => {
    modal({ isOpen: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it("asks the player about Maia's offer to resign", () => {
    const props = modal()
    expect(
      screen.getByRole('dialog', { name: 'Maia is offering to resign' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(props.onAccept).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }))
    expect(props.onPlayOn).toHaveBeenCalledTimes(1)
  })

  it('takes no second answer while the first is on its way', () => {
    modal({ answering: true })
    expect(
      (screen.getByRole('button', { name: 'Accept' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(
      (
        screen.getByRole('button', {
          name: 'Keep playing',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
  })
})
