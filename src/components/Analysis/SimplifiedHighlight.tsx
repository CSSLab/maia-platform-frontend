import React from 'react'

import { Highlight } from './Highlight'

type SimplifiedHighlightProps = React.ComponentProps<typeof Highlight>

export const SimplifiedHighlight: React.FC<SimplifiedHighlightProps> = (
  props,
) => {
  return <Highlight {...props} />
}
