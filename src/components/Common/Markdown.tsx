import ReactMarkdown from 'react-markdown'
import React, { AnchorHTMLAttributes, ClassAttributes } from 'react'

interface Props {
  children: string
}

export const Markdown: React.FC<Props> = ({ children: markdown }: Props) => (
  <ReactMarkdown
    components={{
      h1: ({ children }) => (
        <h1
          id={children?.toString().toLowerCase()}
          className="text-4xl font-bold"
        >
          {children}
        </h1>
      ),
      h2: ({ children }) => (
        <h2
          id={children?.toString().toLowerCase()}
          className="text-3xl font-bold"
        >
          {children}
        </h2>
      ),
      h3: ({ children }) => (
        <h3
          id={children?.toString().toLowerCase()}
          className="text-2xl font-semibold"
        >
          {children}
        </h3>
      ),
      h4: ({ children }) => (
        <h4
          id={children?.toString().toLowerCase()}
          className="text-xl font-semibold"
        >
          {children}
        </h4>
      ),
      h5: ({ children }) => (
        <h5
          id={children?.toString().toLowerCase()}
          className="text-lg font-medium"
        >
          {children}
        </h5>
      ),
      h6: ({ children }) => (
        <h6
          id={children?.toString().toLowerCase()}
          className="text-base font-medium"
        >
          {children}
        </h6>
      ),
      a: ({
        children,
        href,
      }: ClassAttributes<HTMLAnchorElement> &
        AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a
          href={href}
          target={href?.startsWith('/') ? '_self' : '_blank'}
          rel="noreferrer"
        >
          {children}
        </a>
      ),
    }}
  >
    {markdown}
  </ReactMarkdown>
)
