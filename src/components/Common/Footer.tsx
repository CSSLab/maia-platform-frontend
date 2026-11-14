import Image from 'next/image'
import { ReactNode } from 'react'
// Imported, so its address names its contents and browsers keep it a year.
import maiaLogo from 'public/maia-ios-icon.png'
import {
  CONTACT_EMAIL,
  DISCORD_URL,
  X_HANDLE,
  X_URL,
} from 'src/lib/communityLinks'
import { DiscordIcon, XIcon } from './Icons'
import { CommunityPlatform, trackCommunityLinkClicked } from 'src/lib/analytics'

// Define footer data structure
interface FooterLink {
  href: string
  text: string
  icon?: ReactNode
  // Community links report their clicks under this platform.
  platform?: CommunityPlatform
}

// A Material symbol, or a brand's SVG drawn at the same size and colour.
const symbol = (name: string) => (
  <span className="material-symbols-outlined !text-sm md:!text-xs">{name}</span>
)
const brand = (svg: ReactNode) => (
  <span className="flex h-3.5 w-3.5 items-center justify-center md:h-3 md:w-3 [&>svg]:h-full [&>svg]:w-full [&>svg]:fill-current">
    {svg}
  </span>
)

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
          href: 'https://arxiv.org/abs/2605.19091',
          text: "Maia-3 Paper (ICLR '26)",
        },
        {
          href: 'https://www.cs.toronto.edu/~ashton/pubs/maia2-neurips2024.pdf',
          text: "Maia-2 Paper (NeurIPS '24)",
        },
        {
          href: 'https://arxiv.org/abs/2006.01855',
          text: "Maia Paper (KDD '20)",
        },
        {
          href: 'https://csslab.cs.toronto.edu/research/',
          text: 'CSSLab Research',
        },
      ],
    },
    {
      title: 'Open-Source',
      links: [
        {
          href: 'https://github.com/CSSLab/maia3',
          text: 'Maia-3 Model',
        },
        {
          href: 'https://github.com/CSSLab/maia2',
          text: 'Maia-2 Model',
        },
        {
          href: 'https://github.com/CSSLab/maia-chess',
          text: 'Maia Model',
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
          text: 'Maia-1 1100',
        },
        {
          href: 'https://lichess.org/@/maia5',
          text: 'Maia-1 1500',
        },
        {
          href: 'https://lichess.org/@/maia9',
          text: 'Maia-1 1900',
        },
      ],
    },
    {
      title: 'Community',
      links: [
        {
          href: DISCORD_URL,
          text: 'Discord',
          platform: 'discord',
          icon: brand(DiscordIcon),
        },
        {
          href: X_URL,
          text: X_HANDLE,
          platform: 'x',
          icon: brand(XIcon),
        },
        {
          href: `mailto:${CONTACT_EMAIL}`,
          text: CONTACT_EMAIL,
          platform: 'email',
          icon: symbol('mail'),
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
              {/* Asked for at the header's size, so both use one image
                  (each size is a separate download). */}
              <Image
                src={maiaLogo}
                alt="Maia Chess"
                width={40}
                height={40}
                className="h-[26px] w-[26px]"
              />
              <p className="text-xl font-bold text-primary">Maia Chess</p>
            </div>
            <p className="max-w-[200px] text-left text-sm text-secondary md:max-w-[160px] md:text-center md:text-xs">
              A project by the{' '}
              <a
                target="_blank"
                rel="noreferrer"
                href="https://csslab.cs.toronto.edu/"
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
                    onClick={() => {
                      const { platform } = link
                      if (platform)
                        trackCommunityLinkClicked(platform, 'footer')
                    }}
                    {...(link.href.startsWith('mailto:')
                      ? {}
                      : { target: '_blank', rel: 'noreferrer' })}
                    className="mt-0.5 md:mt-0.5"
                  >
                    {link.icon ? (
                      <div className="flex items-center gap-1.5 text-secondary transition duration-200 hover:text-primary/80">
                        {link.icon}
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
          © {new Date().getFullYear()} Maia Chess. All rights reserved.
        </p>
      </div>
    </div>
  )
}
