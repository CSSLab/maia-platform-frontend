import { Chess } from 'chess.ts'
import { GameNode } from './node'

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
    const chess = this.toChess()
    return chess.pgn()
  }

  toChess(): Chess {
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

    return chess
  }

  getRoot(): GameNode {
    return this.root
  }

  getLastMainlineNode(): GameNode {
    const mainLine = this.root.getMainLine()
    return mainLine[mainLine.length - 1]
  }

  getMainLine(): GameNode[] {
    return this.root.getMainLine()
  }

  addMainlineNode(
    node: GameNode,
    fen: string,
    move: string,
    san: string,
    activeModel?: string,
    time?: number,
  ): GameNode {
    return node.addChild(fen, move, san, true, activeModel, time)
  }

  addVariationNode(
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

    const board = new Chess(lastNode.fen)
    const result = board.move(moveUci, { sloppy: true })

    if (result) {
      return this.addMainlineNode(
        lastNode,
        board.fen(),
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
