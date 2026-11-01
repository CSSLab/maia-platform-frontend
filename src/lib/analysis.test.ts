import { GameTree, MaiaEvaluation } from 'src/types'
import { MAIA_MODELS } from 'src/constants/common'
import { collectEngineAnalysisData } from './analysis'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const evaluation: MaiaEvaluation = { policy: { e2e4: 1 }, value: 0.5 }

describe('collectEngineAnalysisData', () => {
  it('saves Maia analysis only when every rating is there', () => {
    const tree = new GameTree(START)
    const root = tree.getRoot()

    // The analysis page adds the selected rating before the others.
    root.addMaiaAnalysis({ maia_kdd_1500: evaluation }, 'maia_kdd_1500')
    expect(collectEngineAnalysisData(tree)).toEqual([])

    root.addMaiaAnalysis(
      Object.fromEntries(MAIA_MODELS.map((model) => [model, evaluation])),
      'maia_kdd_1500',
    )
    const [position] = collectEngineAnalysisData(tree)
    expect(Object.keys(position.maia ?? {})).toHaveLength(MAIA_MODELS.length)
  })
})
