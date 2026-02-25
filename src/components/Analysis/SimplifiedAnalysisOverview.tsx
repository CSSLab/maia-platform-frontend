import React from 'react'

import { Highlight } from './Highlight'
import { SimplifiedBlunderMeter } from './SimplifiedBlunderMeter'

interface SimplifiedAnalysisOverviewProps {
  highlightProps: React.ComponentProps<typeof Highlight>
  blunderMeterProps: React.ComponentProps<typeof SimplifiedBlunderMeter>
  analysisEnabled: boolean
  hideBlunderMeter?: boolean
}

export const SimplifiedAnalysisOverview: React.FC<
  SimplifiedAnalysisOverviewProps
> = ({
  highlightProps,
  blunderMeterProps,
  analysisEnabled,
  hideBlunderMeter = false,
}) => {
  if (hideBlunderMeter) {
    return (
      <div
        className="flex h-full w-full flex-col"
        data-analysis-enabled={analysisEnabled}
      >
        <Highlight {...highlightProps} />
      </div>
    )
  }

  return (
    <div
      className="flex h-full w-full flex-col"
      data-analysis-enabled={analysisEnabled}
    >
      <div className="hidden h-full w-full xl:flex">
        <div className="flex h-full max-w-[60%] flex-shrink-0 basis-[60%] flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-glass-border">
            <Highlight {...highlightProps} />
          </div>
          <div className="flex w-full flex-col">
            <SimplifiedBlunderMeter {...blunderMeterProps} />
          </div>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none relative hidden h-full flex-1 basis-[40%] overflow-hidden border-l border-glass-border xl:block"
        >
          <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.1)_0,rgba(255,255,255,0.1)_2px,rgba(255,255,255,0)_2px,rgba(255,255,255,0)_16px)] opacity-40" />
        </div>
      </div>

      <div className="flex h-full w-full flex-col xl:hidden">
        <Highlight {...highlightProps} />
        <SimplifiedBlunderMeter {...blunderMeterProps} />
      </div>
    </div>
  )
}
