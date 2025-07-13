interface PlayerInfoProps {
  name: string
  color: string
  rating?: number
  termination?: string
  showArrowLegend?: boolean
}

export const PlayerInfo: React.FC<PlayerInfoProps> = ({
  name,
  rating,
  color,
  termination,
  showArrowLegend = false,
}) => {
  return (
    <div className="flex h-10 w-full items-center justify-between bg-background-1 px-4">
      <div className="flex items-center gap-1.5">
        <div
          className={`h-2.5 w-2.5 rounded-full ${color === 'white' ? 'bg-white' : 'border bg-black'}`}
        />
        <p>
          {name ?? 'Unknown'} {rating ? `(${rating})` : null}
        </p>
      </div>
      <div className="flex items-center gap-6">
        {showArrowLegend && (
          <div className="flex items-start gap-2">
            <div className="flex items-center gap-0.5">
              <span className="material-symbols-outlined text-xs text-human-3">
                arrow_outward
              </span>
              <span className="text-xs text-human-3">Most Human Move</span>
            </div>
            <div className="flex items-center gap-0.5">
              <span className="material-symbols-outlined text-xs text-engine-3">
                arrow_outward
              </span>
              <span className="text-xs text-engine-3">Best Engine Move</span>
            </div>
          </div>
        )}
        {termination === color ? (
          <p className="text-engine-3">1</p>
        ) : termination === undefined ? (
          <></>
        ) : termination !== 'none' ? (
          <p className="text-human-3">0</p>
        ) : (
          <p className="text-secondary">½</p>
        )}
      </div>
    </div>
  )
}
