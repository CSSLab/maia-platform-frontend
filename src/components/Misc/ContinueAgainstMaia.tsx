import { trackContinueAgainstMaiaClicked } from 'src/utils/analytics'

interface Props {
  launchContinue: () => void
  background?: string
  sourcePage?: 'puzzles' | 'openings'
  currentFen?: string
}

export const ContinueAgainstMaia: React.FC<Props> = ({
  launchContinue,
  background,
  sourcePage = 'puzzles',
  currentFen = '',
}) => {
  const handleClick = () => {
    trackContinueAgainstMaiaClicked(sourcePage, currentFen)
    launchContinue()
  }

  return (
    <button
      onClick={handleClick}
      className={`flex w-full items-center gap-1.5 rounded px-3 py-2 transition duration-200 ${background ? background : 'bg-human-4 hover:bg-human-3'}`}
    >
      <span className="material-symbols-outlined text-base">swords</span>
      <span>Play position against Maia</span>
    </button>
  )
}
