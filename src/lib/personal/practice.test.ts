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

describe('addMaiaViews', () => {
  beforeEach(() => window.localStorage.clear())

  it("asks Maia about the next positions until the day's are fixable", async () => {
    const { saveGameMoments, loadGameMoments } = jest.requireActual(
      './momentStore',
    ) as typeof import('./momentStore')
    const { practicePool } = jest.requireActual(
      './practiceStore',
    ) as typeof import('./practiceStore')
    const { addMaiaViews } = jest.requireActual(
      './practice',
    ) as typeof import('./practice')
    const after = (moves: string[]) => {
      const chess = new Chess()
      moves.forEach((m) => chess.move(m, { sloppy: true }))
      return chess.fen()
    }
    // Maia gives d2d4 15% in the first position, 2% elsewhere.
    const easy = after([])
    const asked: string[] = []
    const maia = {
      batchEvaluateMaia3: async (fens: string[]) => {
        asked.push(fens[0])
        const share = fens[0] === easy ? 0.15 : 0.02
        return {
          result: fens.map(() => ({ policy: { d2d4: share }, value: 0.5 })),
        }
      },
    }
    const m = (moveIndex: number, fen: string, loss: number) => ({
      moveIndex,
      fen,
      playedMove: 'a2a3',
      playedSan: 'a3',
      bestMove: 'd2d4',
      bestSan: 'd4',
      winrateLoss: loss,
      kind: 'blunder' as const,
      moveLabel: '1.',
    })
    saveGameMoments({
      gameId: 'g',
      gameType: 'lichess',
      color: 'white',
      moments: [
        m(1, after(['h2h3', 'h7h6']), 0.4),
        m(3, easy, 0.3),
        m(5, after(['g2g3', 'g7g6']), 0.2),
      ],
      usedMaia: false,
      playerRating: 1480,
      savedAt: 1,
    })
    await addMaiaViews(maia as never)
    // All three asked once; only the fixable one is left to practise.
    expect(asked).toHaveLength(3)
    expect(practicePool().map((p) => p.id)).toEqual(['g:3'])
    expect(loadGameMoments('g')?.moments[1].maia).toEqual({
      rating: 1500,
      bestShare: 0.15,
      playedShare: 0,
    })
  })
})
