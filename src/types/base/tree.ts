import { Chess, Color } from 'chess.ts'
import { StockfishEvaluation, MaiaEvaluation } from '..'
import { MOVE_CLASSIFICATION_THRESHOLDS } from 'src/constants/moveClassification'

interface NodeAnalysis {
  maia?: { [rating: string]: MaiaEvaluation }
  stockfish?: StockfishEvaluation
}

export class GameTree {
  private root: GameNode
  private headers: Map<string, string>

  constructor(initialFen: string) {
    this.root = new GameNode(initialFen)
    this.headers = new Map<string, string>()

    if (
      initialFen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    ) {
      this.headers.set('SetUp', '1')
      this.headers.set('FEN', initialFen)
    }
  }

  setHeader(key: string, value: string): void {
    this.headers.set(key, value)
  }

  getHeader(key: string): string | undefined {
    return this.headers.get(key)
  }

  toPGN(): string {
    const chess = new Chess()

    if (this.root.fen !== chess.fen()) {
      chess.load(this.root.fen)
    }

    this.headers.forEach((value, key) => {
      chess.addHeader(key, value)
    })

    let complete = false
    let node = this.root
    while (!complete) {
      if (node.mainChild) {
        node = node.mainChild
        chess.move(node.san || node.move || '')
      } else {
        complete = true
      }
    }

    return chess.pgn()
  }

  getRoot(): GameNode {
    return this.root
  }

  getMainLine(): GameNode[] {
    return this.root.getMainLine()
  }

  addMainMove(
    node: GameNode,
    fen: string,
    move: string,
    san: string,
    activeModel?: string,
    time?: number,
  ): GameNode {
    return node.addChild(fen, move, san, true, activeModel, time)
  }

  addVariation(
    node: GameNode,
    fen: string,
    move: string,
    san: string,
    activeModel?: string,
    time?: number,
  ): GameNode {
    if (node.findVariation(move)) {
      return node.findVariation(move) as GameNode
    }
    return node.addChild(fen, move, san, false, activeModel, time)
  }

  toMoveArray(): string[] {
    const moves: string[] = []
    let node = this.root
    while (node.mainChild) {
      node = node.mainChild
      if (node.move) moves.push(node.move)
    }
    return moves
  }

  toTimeArray(): number[] {
    const times: number[] = []
    let node = this.root
    while (node.mainChild) {
      node = node.mainChild
      times.push(node.time || 0)
    }
    return times
  }

  addMoveToMainLine(moveUci: string, time?: number): GameNode | null {
    const mainLine = this.getMainLine()
    const lastNode = mainLine[mainLine.length - 1]

    const chess = new Chess(lastNode.fen)
    const result = chess.move(moveUci, { sloppy: true })

    if (result) {
      return this.addMainMove(
        lastNode,
        chess.fen(),
        moveUci,
        result.san,
        undefined,
        time,
      )
    }

    return null
  }

  addMovesToMainLine(moves: string[], times?: number[]): GameNode | null {
    let currentNode: GameNode | null = null

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i]
      const time = times?.[i]
      currentNode = this.addMoveToMainLine(move, time)
      if (!currentNode) {
        return null
      }
    }

    return currentNode
  }
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

  private parseTurn(fen: string): Color {
    const parts = fen.split(' ')
    return parts[1] as Color
  }

  private parseMoveNumber(fen: string, turn: string): number {
    const parts = fen.split(' ')
    return parseInt(parts[5]) - (turn === 'w' ? 1 : 0)
  }

  // Core classification logic - used by both instance and static methods
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
    if (!stockfishEval || stockfishEval.depth < 13) {
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

        // Excellent: Less than 2% winrate loss AND less than 10% Maia probability
        if (
          absoluteWinrateLoss <
          MOVE_CLASSIFICATION_THRESHOLDS.EXCELLENT_WINRATE_THRESHOLD
        ) {
          if (maiaEval && activeModel && maiaEval[activeModel]) {
            const policy = maiaEval[activeModel].policy
            if (policy && move in policy) {
              const probability = policy[move]
              excellent =
                probability <=
                MOVE_CLASSIFICATION_THRESHOLDS.MAIA_UNLIKELY_THRESHOLD
            }
          }
        }
      }
    } else {
      // Fallback to centipawn-based classification if winrate not available
      const relative_eval = stockfishEval.cp_relative_vec?.[move]
      if (relative_eval !== undefined) {
        blunder = relative_eval < -150
      }
    }

    return {
      blunder,
      inaccuracy,
      excellent,
      bestMove,
    }
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
      this._analysis.stockfish.depth >= 13 &&
      move
    ) {
      this.classifyMoveByWinrate(
        child,
        move,
        this._analysis.stockfish,
        activeModel,
      )
    }

    return child
  }

  addMaiaAnalysis(
    maiaEval: { [rating: string]: MaiaEvaluation },
    activeModel?: string,
  ): void {
    this._analysis.maia = maiaEval

    // Re-classify all children now that we have Maia data
    if (this._analysis.stockfish && this._analysis.stockfish.depth >= 13) {
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
    this._analysis.stockfish = stockfishEval

    if (stockfishEval.depth >= 13) {
      for (const child of this._children) {
        if (child.move) {
          this.classifyMoveByWinrate(
            child,
            child.move,
            stockfishEval,
            activeModel,
          )
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

  promoteVariation(move: string): boolean {
    const variation = this.findVariation(move)
    if (!variation) return false

    if (this._mainChild) {
      this._mainChild._mainline = false
    }

    this._mainChild = variation
    variation._mainline = true
    return true
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
