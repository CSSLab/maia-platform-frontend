import { Dispatch, SetStateAction } from 'react'
import { WorldChampionshipGameListEntry } from 'src/types'
import { useRouter } from 'next/router'
type Props = {
  id: string
  index: number
  currentId: string[] | null
  openIndex: number | null
  setOpenIndex: (index: number | null) => void
  loadingIndex: number | null
  setLoadingIndex: (index: number | null) => void
  openElement: React.RefObject<HTMLDivElement>
  selectedGameElement: React.RefObject<HTMLButtonElement>
  analysisTournamentList: Map<string, WorldChampionshipGameListEntry[]>
  setCurrentMove?: Dispatch<SetStateAction<number>>
  onGameSelected?: () => void
}

export const Tournament = ({
  id,
  index,
  currentId,
  openIndex,
  openElement,
  setOpenIndex,
  loadingIndex,
  setLoadingIndex,
  selectedGameElement,
  analysisTournamentList,
  onGameSelected,
}: Props) => {
  const router = useRouter()
  const games = analysisTournamentList.get(id)
  const [sectionId, title] = id.split('---')
  const opened = openIndex == index
  return (
    <div
      key={index}
      className="flex flex-col items-center"
      ref={openIndex == index ? openElement : null}
    >
      <button
        className={`flex w-full items-center justify-between px-2 py-1 ${opened ? 'bg-glass-strong' : 'bg-glass'}`}
        onClick={
          index == openIndex
            ? () => setOpenIndex(null)
            : () => setOpenIndex(index)
        }
      >
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined w-6 text-left text-sm">
            {openIndex == index ? 'remove' : 'add'}
          </span>
          <div className="text-left text-sm">{title}</div>
        </div>
        <span className="material-symbols-outlined material-symbols-filled text-sm">
          {openIndex == index ? 'arrow_drop_up' : 'arrow_drop_down'}
        </span>
      </button>
      <div
        className={`flex w-full flex-col ${openIndex === index ? 'block' : 'hidden'}`}
      >
        {games?.map((game, j) => {
          const routeType = currentId?.[1]
          const isTypedGameRoute =
            routeType === 'lichess' ||
            routeType === 'play' ||
            routeType === 'hand' ||
            routeType === 'brain' ||
            routeType === 'custom' ||
            routeType === 'stream'
          const selected =
            currentId && !isTypedGameRoute
              ? sectionId == currentId[0] &&
                game.game_index == Number.parseInt(currentId[1], 10)
              : false
          return (
            <button
              key={j}
              className={`group relative flex items-center justify-between text-left ${selected ? 'bg-glass-stronger font-bold' : 'hover:bg-glass-strong'}`}
              onClick={() => {
                setLoadingIndex(j)
                router.push(`/analysis/${sectionId}/${game.game_index}`)
                onGameSelected?.()
              }}
              ref={selected && opened ? selectedGameElement : null}
            >
              <div className="flex items-center justify-start gap-2">
                <div
                  className={`flex h-full w-9 justify-center py-1 ${selected ? 'bg-glass-stronger' : 'bg-glass group-hover:bg-glass-strong'}`}
                >
                  {loadingIndex === j ? (
                    <div className="spinner" />
                  ) : (
                    <p className="text-sm text-secondary">{game.game_index}</p>
                  )}
                </div>
                <div className="items-center whitespace-nowrap text-sm">
                  {game.white.split(',')[0]} – {game.black.split(',')[0]}
                </div>
              </div>
              <div className="whitespace-nowrap text-sm font-light text-secondary">
                {game.result?.replace('1/2', '½').replace('1/2', '½')}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
