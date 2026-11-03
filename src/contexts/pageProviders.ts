import { ReactNode } from 'react'

import { AnalysisListContextProvider } from './AnalysisListContext'
import { MaiaEngineContextProvider } from './MaiaEngineContext'
import {
  LateStockfishEngineContextProvider,
  StockfishEngineContextProvider,
} from './StockfishEngineContext'

// Providers a page asks _app for (`Page.providers`), so the engines' code and
// Maia's move tables load with the pages that use them, not with every page.
export type PageProvider = React.FC<{ children: ReactNode }>

export const ANALYSIS_PROVIDERS: PageProvider[] = [
  MaiaEngineContextProvider,
  StockfishEngineContextProvider,
  AnalysisListContextProvider,
]

export const ENGINE_PROVIDERS: PageProvider[] = [
  MaiaEngineContextProvider,
  StockfishEngineContextProvider,
]

// Drills and puzzles need Stockfish only after a while (a drill is picked
// first; a puzzle is analysed in the background): it starts once the page
// has loaded.
export const LATE_STOCKFISH_PROVIDERS: PageProvider[] = [
  MaiaEngineContextProvider,
  LateStockfishEngineContextProvider,
]

export const MAIA_PROVIDERS: PageProvider[] = [MaiaEngineContextProvider]
