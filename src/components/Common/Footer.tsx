import Image from 'next/image'

// Define footer data structure
interface FooterLink {
  href: string
  text: string
  icon?: string
}

interface FooterSection {
  title: string
  links: FooterLink[]
}

export const Footer: React.FC = () => {
  const footerSections: FooterSection[] = [
    {
      title: 'Research',
      links: [
        {
          href: 'https://arxiv.org/abs/2006.01855',
          text: "Maia Paper (KDD '20)",
        },
        {
          href: 'https://www.cs.toronto.edu/~ashton/pubs/maia2-neurips2024.pdf',
          text: "Maia-2 Paper (NeurIPS '24)",
        },
        {
          href: 'https://csslab.cs.toronto.edu/research/',
          text: 'CSSLab Research',
        },
      ],
    },
    {
      title: 'Opensource',
      links: [
        {
          href: 'https://github.com/CSSLab/maia-chess',
          text: 'Maia Model',
        },
        {
          href: 'https://github.com/CSSLab/maia2',
          text: 'Maia-2 Model',
        },
        {
          href: 'https://github.com/csslab/maia-platform-frontend',
          text: 'Maia Web Platform',
        },
      ],
    },
    {
      title: 'Lichess Bots',
      links: [
        {
          href: 'https://lichess.org/@/maia1',
          text: 'Maia 1100',
        },
        {
          href: 'https://lichess.org/@/maia5',
          text: 'Maia 1500',
        },
        {
          href: 'https://lichess.org/@/maia9',
          text: 'Maia 1900',
        },
      ],
    },
    {
      title: 'Contact',
      links: [
        {
          href: 'https://discord.gg/hHb6gqFpxZ',
          text: 'Discord Community',
          icon: 'link',
        },
        {
          href: 'mailto:maiachess@cs.toronto.edu',
          text: 'maiachess@cs.toronto.edu',
          icon: 'mail',
        },
        {
          href: 'https://x.com/maiachess',
          text: '@maiachess',
          icon: 'link',
        },
      ],
    },
  ]

  return (
    <div className="flex w-full flex-col items-center justify-center py-4">
      <div className="flex w-[90%] flex-col items-start justify-center gap-6 bg-transparent md:items-center">
        <div className="mx-auto mt-1 flex w-full select-none items-center gap-7">
          <div className="h-px flex-1 rounded bg-white/10" aria-hidden="true" />
        </div>
        <div className="flex w-full max-w-4xl flex-col items-start justify-start gap-4 md:flex-row md:items-center md:justify-center md:gap-8">
          <div className="mb-2 flex flex-col items-start gap-1 md:mb-0 md:items-center md:gap-0.5">
            <div className="flex items-center gap-2">
              <Image
                src="/maia-no-bg.png"
                alt="Maia Chess"
                width={26}
                height={26}
              />
              <p className="text-xl font-bold text-primary">Maia Chess</p>
            </div>
            <p className="max-w-[200px] text-left text-sm text-secondary md:max-w-[160px] md:text-center md:text-xs">
              A project by the{' '}
              <a
                target="_blank"
                rel="noreferrer"
                href="http://csslab.cs.toronto.edu/"
                className="text-primary"
              >
                University of Toronto CSSLab
              </a>
            </p>
          </div>
          <div className="hidden h-10 w-[1px] rounded-full bg-white/10 md:block" />
          <div className="flex flex-col gap-6 md:flex-row md:gap-10">
            {footerSections.map((section, index) => (
              <div
                key={index}
                className="flex flex-col items-start justify-start gap-1.5 md:gap-0.5"
              >
                <p className="text-base font-medium md:text-sm">
                  {section.title}
                </p>
                {section.links.map((link, linkIndex) => (
                  <a
                    key={linkIndex}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 md:mt-0.5"
                  >
                    {link.icon ? (
                      <div className="flex items-center gap-1.5 text-secondary transition duration-200 hover:text-primary/80">
                        <span className="material-symbols-outlined !text-sm md:!text-xs">
                          {link.icon}
                        </span>
                        <p className="text-sm md:text-xs">{link.text}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-secondary transition duration-200 hover:text-primary/80 md:text-xs">
                        {link.text}
                      </p>
                    )}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="text-left text-sm text-secondary md:text-center md:text-xs">
          © 2025 Maia Chess. All rights reserved.
        </p>
      </div>
    </div>
  )
}
