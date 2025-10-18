import { Color } from 'chess.ts'
import { StockfishEvaluation, MaiaEvaluation } from '.'
import { MOVE_CLASSIFICATION_THRESHOLDS } from 'src/constants/analysis'
import { calculateMoveColor } from 'src/hooks/useAnalysisController/utils'

interface NodeAnalysis {
  maia?: { [rating: string]: MaiaEvaluation }
  stockfish?: StockfishEvaluation
}

export class GameNode {
  private _fen: string
  private _move: string | null
  private _san: string | null
  private _parent: GameNode | null
  private _children: GameNode[]
  private _mainChild: GameNode | null
  private _mainline: boolean
  private _analysis: NodeAnalysis
  private _turn: Color
  private _check: boolean
  private _blunder: boolean
  private _inaccuracy: boolean
  private _excellentMove: boolean
  private _bestMove: boolean
  private _moveNumber: number
  private _time: number | null
  private _color: string | null

  constructor(
    fen: string,
    move: string | null = null,
    san: string | null = null,
    parent: GameNode | null = null,
    mainline = true,
    time: number | null = null,
  ) {
    this._fen = fen
    this._move = move
    this._san = san
    this._parent = parent
    this._children = []
    this._mainChild = null
    this._mainline = mainline
    this._analysis = {}
    this._blunder = false
    this._inaccuracy = false
    this._excellentMove = false
    this._bestMove = false
    this._turn = this.parseTurn(fen)
    this._check = fen.includes('+')
    this._moveNumber = this.parseMoveNumber(fen, this._turn)
    this._time = time
    this._color = null
  }

  get fen(): string {
    return this._fen
  }
  get move(): string | null {
    return this._move
  }
  get san(): string | null {
    return this._san
  }
  get parent(): GameNode | null {
    return this._parent
  }
  get children(): GameNode[] {
    return this._children
  }
  get isMainline(): boolean {
    return this._mainline
  }
  get mainChild(): GameNode | null {
    return this._mainChild
  }
  get analysis(): NodeAnalysis {
    return this._analysis
  }
  get turn(): Color {
    return this._turn
  }
  get check(): boolean {
    return this._check
  }
  get blunder(): boolean {
    return this._blunder
  }
  get inaccuracy(): boolean {
    return this._inaccuracy
  }
  get excellentMove(): boolean {
    return this._excellentMove
  }
  get bestMove(): boolean {
    return this._bestMove
  }
  get moveNumber(): number {
    return this._moveNumber
  }
  get time(): number | null {
    return this._time
  }
  get color(): string | null {
    return this._color
  }

  private parseTurn(fen: string): Color {
    const parts = fen.split(' ')
    return parts[1] as Color
  }

  private parseMoveNumber(fen: string, turn: string): number {
    const parts = fen.split(' ')
    return parseInt(parts[5]) - (turn === 'w' ? 1 : 0)
  }

  private performMoveClassification(
    stockfishEval: StockfishEvaluation,
    maiaEval: { [rating: string]: MaiaEvaluation } | undefined,
    move: string,
    activeModel?: string,
  ): {
    blunder: boolean
    inaccuracy: boolean
    excellent: boolean
    bestMove: boolean
  } {
    if (!stockfishEval || stockfishEval.depth < 12) {
      return {
        blunder: false,
        inaccuracy: false,
        excellent: false,
        bestMove: false,
      }
    }

    const bestMove = move === stockfishEval.model_move
    let blunder = false
    let inaccuracy = false
    let excellent = false

    if (stockfishEval.winrate_loss_vec) {
      const winrateLoss = stockfishEval.winrate_loss_vec[move]

      if (winrateLoss !== undefined) {
        const absoluteWinrateLoss = Math.abs(winrateLoss)

        // Blunder: More than 10% winrate loss
        blunder =
          absoluteWinrateLoss >=
          MOVE_CLASSIFICATION_THRESHOLDS.BLUNDER_THRESHOLD

        // Inaccuracy: More than 5% winrate loss (but not a blunder)
        inaccuracy =
          !blunder &&
          absoluteWinrateLoss >=
            MOVE_CLASSIFICATION_THRESHOLDS.INACCURACY_THRESHOLD
      }
    } else {
      // Fallback to centipawn-based classification if winrate not available
      const relative_eval = stockfishEval.cp_relative_vec?.[move]
      if (relative_eval !== undefined) {
        blunder = relative_eval < -150
      }
    }

    // Excellent move criteria: Less than 10% Maia probability AND
    // at least 10% higher winrate than weighted average
    if (
      maiaEval &&
      activeModel &&
      maiaEval[activeModel] &&
      stockfishEval.winrate_vec
    ) {
      const policy = maiaEval[activeModel].policy
      if (policy && move in policy) {
        const probability = policy[move]

        // Check Maia probability threshold
        const lowMaiaProbability =
          probability <= MOVE_CLASSIFICATION_THRESHOLDS.MAIA_UNLIKELY_THRESHOLD

        if (lowMaiaProbability) {
          // Calculate weighted average winrate using Maia probabilities as weights
          const weightedAverageWinrate = this.calculateWeightedAverageWinrate(
            stockfishEval.winrate_vec,
            policy,
          )

          const currentMoveWinrate = stockfishEval.winrate_vec[move]
          if (
            currentMoveWinrate !== undefined &&
            weightedAverageWinrate !== null
          ) {
            // Check if current move is at least x% higher than weighted average
            excellent =
              currentMoveWinrate >=
              weightedAverageWinrate +
                MOVE_CLASSIFICATION_THRESHOLDS.EXCELLENT_WINRATE_ADVANTAGE_THRESHOLD
          }
        }
      }
    }

    return {
      blunder,
      inaccuracy,
      excellent,
      bestMove,
    }
  }

  // Helper method to calculate weighted average winrate
  private calculateWeightedAverageWinrate(
    winrateVec: { [move: string]: number },
    maiaPolicy: { [move: string]: number },
  ): number | null {
    let totalWeight = 0
    let weightedSum = 0

    // Calculate weighted sum using Maia probabilities as weights
    for (const move in maiaPolicy) {
      const weight = maiaPolicy[move]
      const winrate = winrateVec[move]

      if (weight !== undefined && winrate !== undefined) {
        weightedSum += weight * winrate
        totalWeight += weight
      }
    }

    // Return weighted average, or null if no valid data
    return totalWeight > 0 ? weightedSum / totalWeight : null
  }

  private classifyMoveByWinrate(
    node: GameNode,
    move: string,
    stockfishEval: StockfishEvaluation,
    activeModel?: string,
  ): void {
    const classification = this.performMoveClassification(
      stockfishEval,
      this._analysis.maia,
      move,
      activeModel,
    )

    node._bestMove = classification.bestMove
    node._blunder = classification.blunder
    node._inaccuracy = classification.inaccuracy
    node._excellentMove = classification.excellent
  }

  addChild(
    fen: string,
    move: string,
    san: string,
    mainline = false,
    activeModel?: string,
    time?: number,
  ): GameNode {
    const child = new GameNode(fen, move, san, this, mainline, time || null)
    this._children.push(child)
    if (mainline) {
      this._mainChild = child
    }

    if (
      this._analysis.stockfish &&
      this._analysis.stockfish.depth >= 12 &&
      move
    ) {
      this.classifyMoveByWinrate(
        child,
        move,
        this._analysis.stockfish,
        activeModel,
      )
      child._color = calculateMoveColor(this._analysis.stockfish, move)
    }

    return child
  }

  addMaiaAnalysis(
    maiaEval: { [rating: string]: MaiaEvaluation },
    activeModel?: string,
  ): void {
    this._analysis.maia = maiaEval

    if (this._analysis.stockfish && this._analysis.stockfish.depth >= 12) {
      for (const child of this._children) {
        if (child.move) {
          this.classifyMoveByWinrate(
            child,
            child.move,
            this._analysis.stockfish,
            activeModel,
          )
        }
      }
    }
  }

  addStockfishAnalysis(
    stockfishEval: StockfishEvaluation,
    activeModel?: string,
  ): void {
    if (
      this._analysis.stockfish &&
      this._analysis.stockfish.depth >= stockfishEval.depth
    ) {
      return
    }

    this._analysis.stockfish = stockfishEval

    if (stockfishEval.depth >= 12) {
      for (const child of this._children) {
        if (child.move) {
          this.classifyMoveByWinrate(
            child,
            child.move,
            stockfishEval,
            activeModel,
          )
          child._color = calculateMoveColor(stockfishEval, child.move)
        }
      }
    }
  }

  getMainLine(): GameNode[] {
    if (!this._mainChild) {
      return [this]
    }
    return [this, ...this._mainChild.getMainLine()]
  }

  getVariations(): GameNode[] {
    return this._children.filter((child) => !child.isMainline)
  }

  findVariation(move: string): GameNode | null {
    return (
      this._children.find(
        (child) => child.move === move && !child.isMainline,
      ) || null
    )
  }

  getPath(): GameNode[] {
    if (!this._parent) {
      return [this]
    }

    return [...this._parent.getPath(), this]
  }

  removeVariation(move: string): boolean {
    const index = this._children.findIndex(
      (child) => child.move === move && !child.isMainline,
    )
    if (index !== -1) {
      this._children.splice(index, 1)
      return true
    }
    return false
  }

  removeAllChildren(): void {
    this._children = []
    this._mainChild = null
  }

  setTime(time: number): void {
    this._time = time
  }

  static classifyMove(
    parentNode: GameNode,
    move: string,
    currentMaiaModel?: string,
  ): {
    blunder: boolean
    inaccuracy: boolean
    excellent: boolean
    bestMove: boolean
  } {
    const tempNode = new GameNode('temp')
    return tempNode.performMoveClassification(
      parentNode.analysis.stockfish || ({} as StockfishEvaluation),
      parentNode.analysis.maia,
      move,
      currentMaiaModel,
    )
  }
}
