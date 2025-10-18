import { motion } from 'framer-motion'

export const PageNavigation = () => {
  return (
    <motion.div
      className="sticky top-0 z-20 flex flex-row flex-wrap items-center justify-center gap-3 border-b border-t border-glass-border bg-black px-3 py-4 text-sm uppercase tracking-wider md:gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <NavLink href="#play-section" label="Play" />
      <NavLink href="#analysis-section" label="Analysis" />
      <NavLink href="#train-section" label="Puzzles" />
      <NavLink href="#more-features" label="Features" />
      <NavLink href="#main_info" label="Project" />
      <NavLink href="#team_info" label="Team" />
    </motion.div>
  )
}

const NavLink = ({ href, label }: { href: string; label: string }) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const targetId = href.substring(1)
    const targetElement = document.getElementById(targetId)

    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className="relative px-2 !text-primary/80 transition-opacity duration-200 hover:!text-primary"
    >
      {label}
      <div className="absolute -bottom-1 left-0 h-0.5 w-0 bg-human-3 transition-all duration-200 hover:w-full" />
    </a>
  )
}
