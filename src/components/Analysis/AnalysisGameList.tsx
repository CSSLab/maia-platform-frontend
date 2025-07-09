import {
  useRef,
  useMemo,
  Dispatch,
  useState,
  useEffect,
  useContext,
  SetStateAction,
} from 'react'
import { motion } from 'framer-motion'

import { Tournament, UserGameList } from 'src/components'
import { AnalysisListContext, GameControllerContext } from 'src/contexts'

interface AnalysisGameListProps {
  currentId: string[] | null
  currentMaiaModel: string
  loadNewTournamentGame: (
    newId: string[],
    setCurrentMove: Dispatch<SetStateAction<number>>,
  ) => Promise<void>
  loadNewLichessGames: (
    id: string,
    pgn: string,
    setCurrentMove: Dispatch<SetStateAction<number>>,
    currentMaiaModel: string,
  ) => Promise<void>
  loadNewUserGames: (
    id: string,
    type: 'play' | 'hand' | 'brain',
    setCurrentMove: Dispatch<SetStateAction<number>>,
    currentMaiaModel: string,
  ) => Promise<void>
}

export const AnalysisGameList: React.FC<AnalysisGameListProps> = ({
  currentId,
  currentMaiaModel,
  loadNewTournamentGame,
  loadNewLichessGames,
  loadNewUserGames,
}) => {
  const [selected, setSelected] = useState<
    'tournament' | 'pgn' | 'play' | 'hand' | 'brain'
  >('pgn')

  const controller = useContext(GameControllerContext)
  const {
    analysisPlayList,
    analysisHandList,
    analysisBrainList,
    analysisLichessList,
    analysisTournamentList,
  } = useContext(AnalysisListContext)
  const listKeys = useMemo(() => {
    return analysisTournamentList
      ? Array.from(analysisTournamentList.keys()).sort((a, b) =>
          b.split('---')[1].localeCompare(a.split('---')[1]),
        )
      : []
  }, [analysisTournamentList])

  const initialOpenIndex = useMemo(() => {
    if (analysisTournamentList && currentId) {
      return listKeys.map((m) => m.split('---')[0]).indexOf(currentId[0])
    } else {
      return null
    }
  }, [analysisTournamentList, currentId, listKeys])

  const [openIndex, setOpenIndex] = useState<number | null>(initialOpenIndex)
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null)

  const openElement = useRef<HTMLDivElement>(null)
  const selectedGameElement = useRef<HTMLButtonElement>(null)

  ;(useEffect(() => {
    if (selectedGameElement.current) {
      selectedGameElement.current.scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
        inline: 'center',
      })
    } else if (openElement.current) {
      openElement.current.scrollIntoView({
        behavior: 'auto',
        block: 'start',
        inline: 'center',
      })
    }
  }),
    [selectedGameElement, openElement])

  useEffect(() => {
    setLoadingIndex(null)
  }, [selected])

  return analysisTournamentList ? (
    <div className="flex flex-col items-start justify-start overflow-hidden rounded bg-background-1">
      <div className="flex min-h-12 w-full items-center justify-center overflow-hidden bg-background-2">
        <button
          onClick={() => setSelected('pgn')}
          className={`relative z-10 flex h-full w-full items-center justify-center gap-1 py-2 pb-3 transition duration-300 ${selected !== 'tournament' ? 'bg-human-4/40' : 'hover:bg-background-3'}`}
        >
          <p
            className={`z-10 font-medium transition duration-200 ${selected !== 'tournament' ? 'text-human-1' : 'text-primary'}`}
          >
            Your Games
          </p>
          <i
            className={`material-symbols-outlined text-lg transition duration-200 ${selected !== 'tournament' ? 'text-human-1' : 'text-primary/80'}`}
          >
            keyboard_arrow_down
          </i>
          {selected !== 'tournament' && (
            <motion.div
              layoutId="selected-highlight"
              className="absolute bottom-0 left-0 h-1 w-full rounded bg-human-2/80"
            />
          )}
        </button>
        <button
          onClick={() => setSelected('tournament')}
          className={`relative z-10 flex h-full w-full items-center justify-center gap-1 py-2 pb-3 transition duration-300 ${selected === 'tournament' ? 'bg-human-4/40' : 'hover:bg-background-3'}`}
        >
          <p
            className={`z-10 font-medium transition duration-200 ${selected === 'tournament' ? 'text-human-1' : 'text-primary'}`}
          >
            WC Matches
          </p>
          <i
            className={`material-symbols-outlined text-lg transition duration-200 ${selected === 'tournament' ? 'text-human-1' : 'text-primary/80'}`}
          >
            keyboard_arrow_down
          </i>
          {selected === 'tournament' && (
            <motion.div
              layoutId="selected-highlight"
              className="absolute bottom-0 left-0 h-1 w-full rounded bg-human-2/80"
            />
          )}
        </button>
      </div>
      {selected === 'tournament' ? (
        <div className="flex w-full flex-col justify-start overflow-y-scroll">
          {listKeys.map((id, i) => (
            <Tournament
              key={i}
              id={id}
              index={i}
              openIndex={openIndex}
              currentId={currentId}
              openElement={openElement}
              setOpenIndex={setOpenIndex}
              loadingIndex={loadingIndex}
              setLoadingIndex={setLoadingIndex}
              selectedGameElement={selectedGameElement}
              loadNewTournamentGame={loadNewTournamentGame}
              analysisTournamentList={analysisTournamentList}
              setCurrentMove={controller.setCurrentIndex}
            />
          ))}
        </div>
      ) : (
        <UserGameList
          currentId={currentId}
          selected={selected}
          setSelected={setSelected}
          playGames={analysisPlayList}
          handGames={analysisHandList}
          brainGames={analysisBrainList}
          lichessGames={analysisLichessList}
          setCurrentIndex={controller.setCurrentIndex}
          currentMaiaModel={currentMaiaModel}
          loadNewUserGames={loadNewUserGames}
          loadNewLichessGames={loadNewLichessGames}
          setLoadingIndex={setLoadingIndex}
        />
      )}
    </div>
  ) : null
}
