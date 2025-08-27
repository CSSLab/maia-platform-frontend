import React from 'react'
import { LiveChessBoardShowcase } from './LiveChessBoardShowcase'

export const LiveChessShowcase: React.FC = () => {
  return (
    <section className="relative w-full overflow-y-visible py-6">
      {/* Header */}
      {/* <div className="mb-6 text-center">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">
          ANALYZED WITH MAIA
        </h2>
      </div> */}

      {/* Live Games Carousel - Full Width */}
      <LiveChessBoardShowcase />
    </section>
  )
}
