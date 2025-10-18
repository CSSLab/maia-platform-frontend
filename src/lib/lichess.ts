import { Chess } from 'chess.ts'
import {
  GameTree,
  StreamedMove,
  type LiveGame,
  type Player,
  type AvailableMoves,
} from 'src/types'

export const readLichessStream =
  (processLine: (data: any) => void) => (response: any) => {
    const stream = response.body.getReader()
    const matcher = /\r?\n/
    const decoder = new TextDecoder()
    let buf = ''

    const loop = () =>
      stream.read().then(({ done, value }: { done: boolean; value: any }) => {
        if (done) {
          if (buf.length > 0) processLine(JSON.parse(buf))
        } else {
          const chunk = decoder.decode(value, {
            stream: true,
          })
          buf += chunk

          const parts = (buf || '').split(matcher)
          buf = parts.pop() as string
          for (const i of parts.filter((p) => p)) processLine(JSON.parse(i))

          return loop()
        }
      })

    return loop()
  }

export const convertLichessStreamToLiveGame = (gameData: any): LiveGame => {
  const { players, id } = gameData

  const whitePlayer: Player = {
    name: players?.white?.user?.id || 'White',
    rating: players?.white?.rating,
  }

  const blackPlayer: Player = {
    name: players?.black?.user?.id || 'Black',
    rating: players?.black?.rating,
  }

  const startingFen =
    gameData.initialFen ||
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  const gameStates = [
    {
      board: startingFen,
      lastMove: undefined as [string, string] | undefined,
      san: undefined as string | undefined,
      check: false as const,
      maia_values: {},
    },
  ]

  const tree = new GameTree(startingFen)

  return {
    id,
    blackPlayer,
    whitePlayer,
    gameType: 'stream',
    type: 'stream' as const,
    moves: gameStates,
    availableMoves: new Array(gameStates.length).fill({}) as AvailableMoves[],
    termination: undefined,
    maiaEvaluations: [],
    stockfishEvaluations: [],
    loadedFen: gameData.fen,
    loaded: false,
    tree,
  } as LiveGame
}

export const handleLichessStreamMove = (
  moveData: StreamedMove,
  currentGame: LiveGame,
) => {
  const { uci, fen } = moveData

  if (!uci || !fen || !currentGame.tree) {
    return currentGame
  }

  let san = uci
  try {
    let beforeMoveNode = currentGame.tree.getRoot()
    while (beforeMoveNode.mainChild) {
      beforeMoveNode = beforeMoveNode.mainChild
    }

    const chess = new Chess(beforeMoveNode.fen)
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] ? (uci[4] as any) : undefined,
    })

    if (move) {
      san = move.san
    }
  } catch (error) {
    console.warn('Could not convert UCI to SAN:', error)
  }

  let currentNode = currentGame.tree.getRoot()
  while (currentNode.mainChild) {
    currentNode = currentNode.mainChild
  }

  try {
    currentGame.tree.getLastMainlineNode().addChild(fen, uci, san, true)
  } catch (error) {
    console.error('Error adding move to tree:', error)
    return currentGame
  }

  const updatedAvailableMoves = [...currentGame.availableMoves, {}]

  return {
    ...currentGame,
    availableMoves: updatedAvailableMoves,
  }
}
