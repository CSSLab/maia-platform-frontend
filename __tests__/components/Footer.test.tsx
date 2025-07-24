import { render, screen } from '@testing-library/react'
import { Footer } from '../../src/components/Common/Footer'

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, width, height }: any) => (
    <img src={src} alt={alt} width={width} height={height} />
  ),
}))

describe('Footer', () => {
  it('should render footer with Maia Chess branding', () => {
    render(<Footer />)

    expect(screen.getByText('Maia Chess')).toBeInTheDocument()
    expect(screen.getByAltText('Maia Chess')).toBeInTheDocument()
  })

  it('should render University of Toronto CSSLab link', () => {
    render(<Footer />)

    const csslabLink = screen.getByRole('link', {
      name: /University of Toronto CSSLab/,
    })
    expect(csslabLink).toBeInTheDocument()
    expect(csslabLink).toHaveAttribute('href', 'http://csslab.cs.toronto.edu/')
    expect(csslabLink).toHaveAttribute('target', '_blank')
    expect(csslabLink).toHaveAttribute('rel', 'noreferrer')
  })

  it('should render all footer sections', () => {
    render(<Footer />)

    expect(screen.getByText('Research')).toBeInTheDocument()
    expect(screen.getByText('Opensource')).toBeInTheDocument()
    expect(screen.getByText('Lichess Bots')).toBeInTheDocument()
    expect(screen.getByText('Contact')).toBeInTheDocument()
  })

  describe('Research section', () => {
    it('should render research links', () => {
      render(<Footer />)

      expect(
        screen.getByRole('link', { name: "Maia Paper (KDD '20)" }),
      ).toHaveAttribute('href', 'https://arxiv.org/abs/2006.01855')
      expect(
        screen.getByRole('link', { name: "Maia-2 Paper (NeurIPS '24)" }),
      ).toHaveAttribute(
        'href',
        'https://www.cs.toronto.edu/~ashton/pubs/maia2-neurips2024.pdf',
      )
      expect(
        screen.getByRole('link', { name: 'CSSLab Research' }),
      ).toHaveAttribute('href', 'https://csslab.cs.toronto.edu/research/')
    })
  })

  describe('Opensource section', () => {
    it('should render opensource links', () => {
      render(<Footer />)

      expect(screen.getByRole('link', { name: 'Maia Model' })).toHaveAttribute(
        'href',
        'https://github.com/CSSLab/maia-chess',
      )
      expect(
        screen.getByRole('link', { name: 'Maia-2 Model' }),
      ).toHaveAttribute('href', 'https://github.com/CSSLab/maia2')
      expect(
        screen.getByRole('link', { name: 'Maia Web Platform' }),
      ).toHaveAttribute(
        'href',
        'https://github.com/csslab/maia-platform-frontend',
      )
    })
  })

  describe('Lichess Bots section', () => {
    it('should render Lichess bot links', () => {
      render(<Footer />)

      expect(screen.getByRole('link', { name: 'Maia 1100' })).toHaveAttribute(
        'href',
        'https://lichess.org/@/maia1',
      )
      expect(screen.getByRole('link', { name: 'Maia 1500' })).toHaveAttribute(
        'href',
        'https://lichess.org/@/maia5',
      )
      expect(screen.getByRole('link', { name: 'Maia 1900' })).toHaveAttribute(
        'href',
        'https://lichess.org/@/maia9',
      )
    })
  })

  describe('Contact section', () => {
    it('should render contact links with icons', () => {
      render(<Footer />)

      const discordLink = screen.getByRole('link', {
        name: /Discord Community/,
      })
      expect(discordLink).toHaveAttribute(
        'href',
        'https://discord.gg/hHb6gqFpxZ',
      )

      const emailLink = screen.getByRole('link', {
        name: /maiachess@cs.toronto.edu/,
      })
      expect(emailLink).toHaveAttribute(
        'href',
        'mailto:maiachess@cs.toronto.edu',
      )

      const twitterLink = screen.getByRole('link', { name: /@maiachess/ })
      expect(twitterLink).toHaveAttribute('href', 'https://x.com/maiachess')
    })

    it('should render contact link icons', () => {
      render(<Footer />)

      // Check for Material Icons in contact section
      const mailIcon = screen.getByText('mail')
      expect(mailIcon).toBeInTheDocument()
      expect(mailIcon).toHaveClass('material-symbols-outlined')

      const linkIcons = screen.getAllByText('link')
      expect(linkIcons).toHaveLength(2) // Discord and Twitter
      linkIcons.forEach((icon) => {
        expect(icon).toHaveClass('material-symbols-outlined')
      })
    })
  })

  it('should render all links with correct target and rel attributes', () => {
    render(<Footer />)

    const externalLinks = screen.getAllByRole('link')

    // Filter out the CSSLab link which we already tested separately
    const footerSectionLinks = externalLinks.filter(
      (link) => !link.getAttribute('href')?.includes('csslab.cs.toronto.edu'),
    )

    footerSectionLinks.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noreferrer')
    })
  })

  it('should render copyright notice', () => {
    render(<Footer />)

    expect(
      screen.getByText('© 2025 Maia Chess. All rights reserved.'),
    ).toBeInTheDocument()
  })

  it('should render Maia logo image with correct attributes', () => {
    render(<Footer />)

    const logo = screen.getByAltText('Maia Chess')
    expect(logo).toHaveAttribute('src', '/maia-no-bg.png')
    expect(logo).toHaveAttribute('width', '26')
    expect(logo).toHaveAttribute('height', '26')
  })

  it('should have responsive styling classes', () => {
    render(<Footer />)

    const footerContainer = screen.getByText('Maia Chess').closest('div')
      ?.parentElement?.parentElement?.parentElement
    expect(footerContainer).toHaveClass('bg-background-1/60', 'px-6', 'py-8')
  })

  it('should render links without icons as plain text', () => {
    render(<Footer />)

    // Research links don't have icons
    const maiapaperLink = screen.getByRole('link', {
      name: "Maia Paper (KDD '20)",
    })
    expect(
      maiapaperLink.querySelector('.material-symbols-outlined'),
    ).not.toBeInTheDocument()
  })

  it('should render links with icons as icon + text combinations', () => {
    render(<Footer />)

    // Contact links have icons
    const discordLink = screen.getByRole('link', { name: /Discord Community/ })
    expect(
      discordLink.querySelector('.material-symbols-outlined'),
    ).toBeInTheDocument()
  })
})
