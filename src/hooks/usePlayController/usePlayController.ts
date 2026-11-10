import { Color, Check, GameTree, Termination, PlayGameConfig } from 'src/types'
import { AllStats } from '../useStats'
import { PlayedGame, QueuedPremove } from 'src/types/play'
import { Chess, Piece, SQUARES } from 'chess.ts'
import { useTreeController } from '../useTreeController'
import { usePlayGameTracking } from './usePlayGameTracking'
import { useMemo, useState, useCallback, useEffect } from 'react'
import { initialClockSeconds } from 'src/lib/timeControl'
import { UnfinishedGame } from 'src/lib/unfinishedGame'

const nullFen = new Chess().fen()

const computeTermination = (chess: Chess): Termination | undefined => {
  if (!chess.gameOver()) {
    return undefined
  }

  if (chess.inDraw() || chess.inStalemate() || chess.inThreefoldRepetition()) {
    return {
      result: '1/2-1/2',
      winner: 'none',
      type: 'rules',
    }
  }

  const turn = chess.turn() == 'w' ? 'white' : 'black'

  if (chess.inCheckmate()) {
    return {
      result: turn == 'white' ? '0-1' : '1-0',
      winner: turn == 'white' ? 'black' : 'white',
      type: 'rules',
    }
  }
}

const computeTimeTermination = (
  chess: Chess,
  playerWhoRanOutOfTime: Color,
): Termination => {
  // If there's insufficient material on the board, it's a draw
  if (chess.insufficientMaterial()) {
    return {
      result: '1/2-1/2',
      winner: 'none',
      type: 'time',
    }
  }

  // Otherwise, the player who ran out of time loses
  return {
    result: playerWhoRanOutOfTime === 'white' ? '0-1' : '1-0',
    winner: playerWhoRanOutOfTime === 'white' ? 'black' : 'white',
    type: 'time',
  }
}

export const usePlayController = (
  id: string,
  config: PlayGameConfig,
  // A game continued from where it was left (src/lib/unfinishedGame.ts).
  resume?: UnfinishedGame,
) => {
  const [gameTree, setGameTree] = useState<GameTree>(() => {
    const tree = new GameTree(config.startFen || nullFen)
    if (resume) tree.addMovesToMainLine(resume.moves, resume.moveTimes)
    return tree
  })

  const controller = useTreeController(gameTree, config.player)

  // A continued game opens on its last position (the tree controller starts
  // at the root).
  useEffect(() => {
    if (resume) controller.setCurrentNode(gameTree.getLastMainlineNode())
  }, [])

  const [treeVersion, setTreeVersion] = useState<number>(0)
  const [resigned, setResigned] = useState<boolean>(false)
  const [timeExpired, setTimeExpired] = useState<Color | null>(null)

  const incrementSeconds =
    config.timeControl == 'unlimited'
      ? 0
      : Number(config.timeControl.split('+')[1]) || 0
  // "0+N" starts at 3 seconds (see initialClockSeconds).
  const initialClockValue = initialClockSeconds(config.timeControl) * 1000

  // A continued game's clocks were paused while it was away: they run again
  // from now.
  const [whiteClock, setWhiteClock] = useState<number>(
    resume?.whiteClock ?? initialClockValue,
  )
  const [blackClock, setBlackClock] = useState<number>(
    resume?.blackClock ?? initialClockValue,
  )
  const [lastMoveTime, setLastMoveTime] = useState<number>(() =>
    resume && resume.moves.length >= 2 ? Date.now() : 0,
  )

  const moveList = useMemo(
    () => gameTree.toMoveArray(),
    [gameTree, treeVersion],
  )

  const moveTimes = useMemo(
    () => gameTree.toTimeArray(),
    [gameTree, treeVersion],
  )

  const game: PlayedGame = useMemo(() => {
    const mainLine = gameTree.getMainLine()

    const lastNode = mainLine[mainLine.length - 1]
    const turn = lastNode.turn
    const chess = gameTree.toChess()

    // A mating move that was registered stands even if the clock ran out
    // at the same moment, so checkmate takes precedence over the flag.
    const termination = chess.inCheckmate()
      ? computeTermination(chess)
      : timeExpired
        ? computeTimeTermination(chess, timeExpired)
        : resigned
          ? ({
              result: turn == 'w' ? '0-1' : '1-0',
              winner: turn == 'w' ? 'black' : 'white',
              type: 'resign',
            } as Termination)
          : computeTermination(chess)

    const moves = []
    const rootNode = gameTree.getRoot()
    const rootChess = new Chess(rootNode.fen)
    moves.push({
      board: rootNode.fen,
      check: rootChess.inCheck()
        ? ((rootChess.turn() === 'w' ? 'white' : 'black') as Check)
        : false,
    })

    for (let i = 1; i < mainLine.length; i++) {
      const node = mainLine[i]
      const nodeChess = new Chess(node.fen)
      moves.push({
        board: node.fen,
        san: node.san || undefined,
        lastMove: node.move
          ? ([node.move.slice(0, 2), node.move.slice(2, 4)] as [string, string])
          : undefined,
        uci: node.move || undefined,
        check: nodeChess.inCheck()
          ? ((nodeChess.turn() === 'w' ? 'white' : 'black') as Check)
          : false,
      })
    }

    return {
      id,
      termination,
      tree: gameTree,
      turn: turn == 'b' ? 'black' : 'white',
    }
  }, [gameTree, treeVersion, resigned, timeExpired, whiteClock, blackClock, id])

  usePlayGameTracking(id, config, moveList.length, game.termination)

  const toPlay: Color | null = game.termination ? null : game.turn
  const playerActive = toPlay == config.player

  const { availableMoves, pieces } = useMemo(() => {
    if (!controller.currentNode) return { availableMoves: [], pieces: {} }

    const chess = new Chess(controller.currentNode.fen)
    const verboseMoves = chess.moves({ verbose: true })

    // No moves until the game has its id (/play/maia shows the game while
    // start_game answers): a move needs it to be logged.
    const cantMove = !playerActive || game.termination || !id

    const availableMoves = cantMove
      ? []
      : verboseMoves.map((move) => ({
          from: move.from,
          to: move.to,
          promotion: move.promotion,
          piece: move.piece,
        }))

    const pieces: Record<string, Piece> = {}
    for (const [square] of Object.entries(SQUARES)) {
      const piece = chess.get(square)
      if (piece) {
        pieces[square] = piece
      }
    }

    return { availableMoves, pieces }
  }, [controller.currentNode, playerActive, game.termination, treeVersion, id])

  const updateClockForColor = useCallback(
    (
      color: Color,
      overrideTime: number | undefined = undefined,
      forceClockUpdate = false,
    ): number => {
      if (moveList.length < 2 && !forceClockUpdate) {
        return 0 // Clock does not start until first two moves made
      }

      const now = Date.now()
      const elapsed =
        overrideTime === undefined ? now - lastMoveTime : overrideTime

      if (lastMoveTime > 0) {
        if (color == 'white') {
          setWhiteClock(
            Math.max(whiteClock - elapsed + incrementSeconds * 1000, 0),
          )
        } else {
          setBlackClock(
            Math.max(blackClock - elapsed + incrementSeconds * 1000, 0),
          )
        }
      }

      setLastMoveTime(now)
      return elapsed
    },
    [moveList.length, lastMoveTime, whiteClock, blackClock, incrementSeconds],
  )

  const updateClock = useCallback(
    (overrideTime: number | undefined = undefined): number => {
      if (!toPlay) {
        return 0
      }

      return updateClockForColor(toPlay, overrideTime)
    },
    [toPlay, updateClockForColor],
  )

  const expireOnTime = useCallback((color: Color) => {
    const now = Date.now()

    if (color == 'white') {
      setWhiteClock(0)
    } else {
      setBlackClock(0)
    }

    setLastMoveTime(now)
    setTimeExpired(color)
  }, [])

  useEffect(() => {
    if (
      !game.termination &&
      moveList.length > 1 &&
      config.timeControl != 'unlimited' &&
      toPlay
    ) {
      const activeColor = toPlay
      const timeRemaining = activeColor == 'white' ? whiteClock : blackClock
      const timeout = setTimeout(() => {
        expireOnTime(activeColor)
      }, timeRemaining)

      return () => clearTimeout(timeout)
    }
  }, [
    expireOnTime,
    game.termination,
    blackClock,
    moveList.length,
    config.timeControl,
    toPlay,
    whiteClock,
  ])

  const addMoveWithTime = useCallback(
    (moveUci: string, moveTime: number) => {
      const lastNode = gameTree.getLastMainlineNode()
      const board = new Chess(lastNode.fen)
      const result = board.move(moveUci, { sloppy: true })

      if (result) {
        const newNode = lastNode.addChild(
          board.fen(),
          moveUci,
          result.san,
          true,
          undefined,
          moveTime,
        )

        if (newNode) {
          // Tree is modified in place, so we need to trigger re-renders
          setTreeVersion((prev) => prev + 1)
          controller.setCurrentNode(newNode)
        }
      }
    },
    [gameTree, controller.setCurrentNode],
  )

  // The player's last move, and Maia's reply to it if there is one, so
  // that it is the player's turn again (practice games). The clocks keep
  // their times: the side whose clock was running is charged up to now, and
  // the player's clock runs from here.
  const playerMovesPlayed = useMemo(() => {
    const mainLine = gameTree.getMainLine()
    const playerTurn = config.player === 'white' ? 'w' : 'b'
    // A node's mover is the side not to move in it.
    return mainLine.slice(1).filter((node) => node.turn !== playerTurn).length
  }, [gameTree, treeVersion, config.player])
  const canTakeBack =
    !!config.practice && !game.termination && playerMovesPlayed > 0

  // Charges the running clock (the side to move's) with the time since the
  // last move, without increment, and restarts the count from now, so a
  // clock change mid-move keeps the running time.
  const chargeRunningClock = useCallback(() => {
    if (moveList.length < 2 || lastMoveTime <= 0 || !toPlay) return
    const elapsed = Date.now() - lastMoveTime
    if (toPlay === 'white') {
      setWhiteClock((clock) => Math.max(clock - elapsed, 0))
    } else {
      setBlackClock((clock) => Math.max(clock - elapsed, 0))
    }
    setLastMoveTime(Date.now())
  }, [moveList.length, lastMoveTime, toPlay])

  const takeBack = useCallback(() => {
    if (!canTakeBack) return

    const tip = gameTree.getLastMainlineNode()
    const plies = playerActive ? 2 : 1
    let target = tip
    for (let i = 0; i < plies && target.parent; i++) {
      target = target.parent
    }

    chargeRunningClock()
    // Clocks only run from the second move on: back before it, they wait
    // to start again.
    if (moveList.length - plies < 2) setLastMoveTime(0)

    target.removeAllChildren()
    setTreeVersion((prev) => prev + 1)
    controller.setCurrentNode(target)
  }, [
    canTakeBack,
    gameTree,
    playerActive,
    moveList.length,
    chargeRunningClock,
    controller.setCurrentNode,
  ])

  // Extra time on the player's clock, on request (practice games).
  const canAddTime =
    !!config.practice && !game.termination && config.timeControl != 'unlimited'
  const addTime = useCallback(
    (ms: number) => {
      if (!canAddTime) return
      chargeRunningClock()
      if (config.player === 'white') {
        setWhiteClock((clock) => clock + ms)
      } else {
        setBlackClock((clock) => clock + ms)
      }
    },
    [canAddTime, config.player, chargeRunningClock],
  )

  const reset = () => {
    const newTree = new GameTree(config.startFen || nullFen)
    setGameTree(newTree)
    setResigned(false)
    setTimeExpired(null)
    setLastMoveTime(0)
    setWhiteClock(initialClockValue)
    setBlackClock(initialClockValue)
    setTreeVersion((prev) => prev + 1)
  }

  const makePlayerMove = async (
    _moveUci: string,
    _moveTimeOverride?: number,
  ): Promise<void> => {
    throw new Error(
      'makePlayerMove should be overridden by the consuming component',
    )
  }

  const queuedPremove = null as QueuedPremove | null
  const setPremove = (_from: string, _to: string) => {
    return
  }
  const clearPremove = () => {
    return
  }

  const stats: AllStats = {
    lifetime: undefined,
    session: { gamesWon: 0, gamesPlayed: 0 },
    lastRating: undefined,
    rating: 0,
  }

  return {
    game,
    gameTree: controller.tree,
    currentNode: controller.currentNode,
    player: config.player,
    playType: config.playType,
    maiaVersion: config.maiaVersion,
    toPlay,
    playerActive,
    moveList,
    moves: moveList,
    moveTimes,
    availableMoves,
    pieces,
    timeControl: config.timeControl,
    whiteClock,
    blackClock,
    lastMoveTime,
    stats,

    setCurrentNode: controller.setCurrentNode,
    goToNode: controller.goToNode,
    goToNextNode: controller.goToNextNode,
    goToPreviousNode: controller.goToPreviousNode,
    goToRootNode: controller.goToRootNode,
    plyCount: controller.plyCount,
    orientation: controller.orientation,
    setOrientation: controller.setOrientation,

    addMoveWithTime,
    setResigned,
    reset,
    practice: !!config.practice,
    canTakeBack,
    takeBack,
    canAddTime,
    addTime,
    makePlayerMove,
    updateClock,
    updateClockForColor,
    premovesEnabled: false,
    queuedPremove,
    setPremove,
    clearPremove,
    premoveResetKey: 0,
  }
}
