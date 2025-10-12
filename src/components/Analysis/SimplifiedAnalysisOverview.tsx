import React from 'react'

import { SimplifiedHighlight } from './SimplifiedHighlight'
import { SimplifiedBlunderMeter } from './SimplifiedBlunderMeter'

interface SimplifiedAnalysisOverviewProps {
  highlightProps: React.ComponentProps<typeof SimplifiedHighlight>
  blunderMeterProps: React.ComponentProps<typeof SimplifiedBlunderMeter>
  analysisEnabled: boolean
}

export const SimplifiedAnalysisOverview: React.FC<
  SimplifiedAnalysisOverviewProps
> = ({ highlightProps, blunderMeterProps, analysisEnabled }) => {
  return (
    <div
      className="flex h-full w-full flex-col"
      data-analysis-enabled={analysisEnabled}
    >
      <div className="hidden h-full w-full xl:flex">
        <div className="flex h-full w-full flex-1">
          <div className="flex h-full w-auto min-w-[60%] max-w-[60%] flex-col overflow-hidden border-r border-glass-border">
            <SimplifiedHighlight {...highlightProps} />
          </div>
          <div className="flex h-full w-full flex-col">
            <SimplifiedBlunderMeter {...blunderMeterProps} />
          </div>
        </div>
      </div>

      <div className="flex h-full w-full flex-col gap-3 xl:hidden">
        <SimplifiedHighlight {...highlightProps} />
        <SimplifiedBlunderMeter {...blunderMeterProps} />
      </div>
    </div>
  )
}
