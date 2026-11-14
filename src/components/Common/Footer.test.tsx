import { fireEvent, render, screen } from '@testing-library/react'
import { Footer } from './Footer'
import { trackCommunityLinkClicked } from 'src/lib/analytics'
import {
  CONTACT_EMAIL,
  DISCORD_URL,
  X_HANDLE,
  X_URL,
} from 'src/lib/communityLinks'

jest.mock('src/lib/analytics', () => ({
  trackCommunityLinkClicked: jest.fn(),
}))

describe('Footer community links', () => {
  beforeEach(() => jest.clearAllMocks())

  it('link to the one Discord invite, X and email', () => {
    render(<Footer />)
    expect(screen.getByText('Community')).toBeInTheDocument()
    expect(screen.getByText('Discord').closest('a')).toHaveAttribute(
      'href',
      DISCORD_URL,
    )
    expect(screen.getByText(X_HANDLE).closest('a')).toHaveAttribute(
      'href',
      X_URL,
    )
    expect(screen.getByText(CONTACT_EMAIL).closest('a')).toHaveAttribute(
      'href',
      `mailto:${CONTACT_EMAIL}`,
    )
  })

  it('report which community link was followed, and no other', () => {
    render(<Footer />)
    fireEvent.click(screen.getByText('Discord'))
    fireEvent.click(screen.getByText(X_HANDLE))
    fireEvent.click(screen.getByText(CONTACT_EMAIL))
    fireEvent.click(screen.getByText("Maia-3 Paper (ICLR '26)"))
    expect((trackCommunityLinkClicked as jest.Mock).mock.calls).toEqual([
      ['discord', 'footer'],
      ['x', 'footer'],
      ['email', 'footer'],
    ])
  })
})
