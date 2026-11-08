import { ReactNode } from 'react'
import { MaiaEngineContextProvider } from 'src/contexts/MaiaEngineContext'
import { LateStockfishEngineContextProvider } from 'src/contexts/StockfishEngineContext'

/**
 * Stockfish (started once the page has loaded) and Maia (only if this
 * browser already has the model: nothing is downloaded without the visitor's
 * yes in the download dialog), without the loading toasts the analysis pages
 * show: the cards show their own state.
 */
export const PersonalEngines = ({ children }: { children: ReactNode }) => (
  <MaiaEngineContextProvider quiet>
    <LateStockfishEngineContextProvider quiet>
      {children}
    </LateStockfishEngineContextProvider>
  </MaiaEngineContextProvider>
)
