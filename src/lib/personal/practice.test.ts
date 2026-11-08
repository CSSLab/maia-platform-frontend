import { Chess } from 'chess.ts'
import { StockfishEngine, StockfishEvaluation } from 'src/types'
import { PRACTICE_CORRECT_MARGIN, gradeAnswer } from './practice'

jest.mock('src/api/analysis', () => ({ retrieveGameAnalysisCache: jest.fn() }))

const FEN = new Chess().fen()

const engine = (losses: Record<string, number>, forced: string[][] = []) =>
  ({
    status: 'ready',
    error: null,
    isReady: () => true,
    stopEvaluation: jest.fn(),
    streamEvaluations: (_fen, _count, depth, options) => {
      forced.push(options?.forcedCandidateMoves ?? [])
      const evaluation: StockfishEvaluation = {
        sent: true,
        depth: depth ?? 14,
        model_move: 'e2e4',
        model_optimal_cp: 30,
        cp_vec: {},
        cp_relative_vec: {},
        winrate_loss_vec: { e2e4: 0, ...losses },
      }
      return (async function* () {
        yield evaluation
      })()
    },
  }) as StockfishEngine

describe('gradeAnswer', () => {
  it(`counts a move within ${PRACTICE_CORRECT_MARGIN * 100} points of the best`, async () => {
    const forced: string[][] = []
    const sf = engine({ d2d4: -0.015, g1f3: -0.03 }, forced)
    expect((await gradeAnswer(FEN, 'd2d4', 'e2e4', sf)).correct).toBe(true)
    expect((await gradeAnswer(FEN, 'g1f3', 'e2e4', sf)).correct).toBe(false)
    // The answer and the known best are searched in full.
    expect(forced[0]).toEqual(['d2d4', 'e2e4'])
  })

  it('takes the known best move without asking the engine', async () => {
    const forced: string[][] = []
    expect(
      (await gradeAnswer(FEN, 'e2e4', 'e2e4', engine({}, forced))).correct,
    ).toBe(true)
    expect(forced).toEqual([])
  })

  it('takes any mate in one', async () => {
    // Fool's mate position, Black to move: Qh4#.
    const chess = new Chess()
    for (const san of ['f3', 'e5', 'g4']) chess.move(san)
    const forced: string[][] = []
    expect(
      (await gradeAnswer(chess.fen(), 'd8h4', 'x', engine({}, forced))).correct,
    ).toBe(true)
    expect(forced).toEqual([])
  })
})
