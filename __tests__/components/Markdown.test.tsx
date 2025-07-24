import { render, screen } from '@testing-library/react'
import { Markdown } from '../../src/components/Common/Markdown'

// Mock react-markdown
jest.mock('react-markdown', () => {
  const MockReactMarkdown = ({ children, components }: any) => {
    // Simulate the markdown parsing and component rendering
    const lines = (children || '')
      .split('\n')
      .filter((line: string) => line.trim())

    return (
      <div data-testid="markdown-content">
        {lines.map((line: string, index: number) => {
          // Handle headings
          if (line.startsWith('# ')) {
            const text = line.substring(2)
            const H1 = components.h1
            return <H1 key={index}>{text}</H1>
          }
          if (line.startsWith('## ')) {
            const text = line.substring(3)
            const H2 = components.h2
            return <H2 key={index}>{text}</H2>
          }
          if (line.startsWith('### ')) {
            const text = line.substring(4)
            const H3 = components.h3
            return <H3 key={index}>{text}</H3>
          }
          if (line.startsWith('#### ')) {
            const text = line.substring(5)
            const H4 = components.h4
            return <H4 key={index}>{text}</H4>
          }
          if (line.startsWith('##### ')) {
            const text = line.substring(6)
            const H5 = components.h5
            return <H5 key={index}>{text}</H5>
          }
          if (line.startsWith('###### ')) {
            const text = line.substring(7)
            const H6 = components.h6
            return <H6 key={index}>{text}</H6>
          }

          // Handle links
          const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/)
          if (linkMatch) {
            const [, text, href] = linkMatch
            const A = components.a
            return (
              <A key={index} href={href}>
                {text}
              </A>
            )
          }

          // Handle paragraphs
          const P = components.p
          return <P key={index}>{line}</P>
        })}
      </div>
    )
  }
  MockReactMarkdown.displayName = 'MockReactMarkdown'
  return MockReactMarkdown
})

describe('Markdown', () => {
  it('should render markdown content', () => {
    render(<Markdown>Hello World</Markdown>)

    expect(screen.getByTestId('markdown-content')).toBeInTheDocument()
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('should render h1 with correct styling and id', () => {
    render(<Markdown># Main Title</Markdown>)

    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toBeInTheDocument()
    expect(h1).toHaveTextContent('Main Title')
    expect(h1).toHaveClass('text-4xl', 'font-bold')
    expect(h1).toHaveAttribute('id', 'main title')
  })

  it('should render h2 with correct styling and id', () => {
    render(<Markdown>## Section Title</Markdown>)

    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2).toBeInTheDocument()
    expect(h2).toHaveTextContent('Section Title')
    expect(h2).toHaveClass('text-3xl', 'font-bold')
    expect(h2).toHaveAttribute('id', 'section title')
  })

  it('should render h3 with correct styling and id', () => {
    render(<Markdown>### Subsection</Markdown>)

    const h3 = screen.getByRole('heading', { level: 3 })
    expect(h3).toBeInTheDocument()
    expect(h3).toHaveTextContent('Subsection')
    expect(h3).toHaveClass('text-2xl', 'font-semibold')
    expect(h3).toHaveAttribute('id', 'subsection')
  })

  it('should render h4 with correct styling and id', () => {
    render(<Markdown>#### Small Heading</Markdown>)

    const h4 = screen.getByRole('heading', { level: 4 })
    expect(h4).toBeInTheDocument()
    expect(h4).toHaveTextContent('Small Heading')
    expect(h4).toHaveClass('text-xl', 'font-semibold')
    expect(h4).toHaveAttribute('id', 'small heading')
  })

  it('should render h5 with correct styling and id', () => {
    render(<Markdown>##### Smaller Heading</Markdown>)

    const h5 = screen.getByRole('heading', { level: 5 })
    expect(h5).toBeInTheDocument()
    expect(h5).toHaveTextContent('Smaller Heading')
    expect(h5).toHaveClass('text-lg', 'font-medium')
    expect(h5).toHaveAttribute('id', 'smaller heading')
  })

  it('should render h6 with correct styling and id', () => {
    render(<Markdown>###### Smallest Heading</Markdown>)

    const h6 = screen.getByRole('heading', { level: 6 })
    expect(h6).toBeInTheDocument()
    expect(h6).toHaveTextContent('Smallest Heading')
    expect(h6).toHaveClass('text-base', 'font-medium')
    expect(h6).toHaveAttribute('id', 'smallest heading')
  })

  it('should render paragraphs with correct styling', () => {
    render(<Markdown>This is a paragraph.</Markdown>)

    const paragraph = screen.getByText('This is a paragraph.')
    expect(paragraph.tagName).toBe('P')
    expect(paragraph).toHaveClass('text-sm')
  })

  it('should render external links with correct attributes', () => {
    render(<Markdown>[External Link](https://example.com)</Markdown>)

    const link = screen.getByRole('link', { name: 'External Link' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('should render internal links with _self target', () => {
    render(<Markdown>[Internal Link](/internal-page)</Markdown>)

    const link = screen.getByRole('link', { name: 'Internal Link' })
    expect(link).toHaveAttribute('href', '/internal-page')
    expect(link).toHaveAttribute('target', '_self')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('should handle empty string children', () => {
    render(<Markdown></Markdown>)

    expect(screen.getByTestId('markdown-content')).toBeInTheDocument()
  })

  it('should handle multiline markdown', () => {
    const multilineMarkdown = `# Title
## Subtitle
This is a paragraph.`

    render(<Markdown>{multilineMarkdown}</Markdown>)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Subtitle',
    )
    expect(screen.getByText('This is a paragraph.')).toBeInTheDocument()
  })

  it('should handle headings with special characters', () => {
    render(<Markdown># Special-Title_With123Numbers</Markdown>)

    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveAttribute('id', 'special-title_with123numbers')
  })

  it('should handle case sensitivity in heading IDs', () => {
    render(<Markdown># UPPERCASE Title</Markdown>)

    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveAttribute('id', 'uppercase title')
  })

  it('should handle links with different protocols', () => {
    render(<Markdown>[HTTPS Link](https://secure.com)</Markdown>)

    const link = screen.getByRole('link', { name: 'HTTPS Link' })
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('should handle relative paths as internal links', () => {
    render(<Markdown>[Relative Link](./relative-path)</Markdown>)

    const link = screen.getByRole('link', { name: 'Relative Link' })
    expect(link).toHaveAttribute('target', '_blank') // Not starting with '/', so external
  })

  it('should handle root-relative paths as internal links', () => {
    render(<Markdown>[Root Relative](/path/to/page)</Markdown>)

    const link = screen.getByRole('link', { name: 'Root Relative' })
    expect(link).toHaveAttribute('target', '_self')
  })
})
