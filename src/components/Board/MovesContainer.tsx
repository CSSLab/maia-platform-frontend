/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { Tooltip } from 'react-tooltip'
import React, { useContext, useMemo, Fragment, useEffect } from 'react'
import { WindowSizeContext } from 'src/contexts'
import { GameNode, AnalyzedGame, Termination, BaseGame } from 'src/types'
import { TuringGame } from 'src/types/turing'
import { useBaseTreeController } from 'src/hooks/useBaseTreeController'

interface AnalysisProps {
  game: BaseGame | AnalyzedGame
  highlightIndices?: number[]
  termination?: Termination
  type: 'analysis'
  showAnnotations?: boolean
  showVariations?: boolean
}

interface TuringProps {
  game: TuringGame
  highlightIndices?: number[]
  termination?: Termination
  type: 'turing'
  showAnnotations?: boolean
  showVariations?: boolean
}

interface PlayProps {
  game: BaseGame
  highlightIndices?: number[]
  termination?: Termination
  type: 'play'
  showAnnotations?: boolean
  showVariations?: boolean
}

type Props = AnalysisProps | TuringProps | PlayProps

function BlunderIcon() {
  return (
    <>
      <div
        className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#d73027] text-[10px] font-bold text-white"
        data-tooltip-id="blunder-tooltip"
      >
        !
      </div>
      <Tooltip
        id="blunder-tooltip"
        content="Critical Mistake"
        place="top"
        delayShow={300}
        className="z-50 !bg-background-2 !px-2 !py-1 !text-xs"
      />
    </>
  )
}

function InaccuracyIcon() {
  return (
    <div className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#f46d43] text-[10px] font-bold text-white">
      ?
    </div>
  )
}

function GoodMoveIcon() {
  return (
    <div className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#74add1] text-[10px] font-bold text-white">
      !
    </div>
  )
}

function ExcellentMoveIcon() {
  return (
    <div className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#4575b4] text-[10px] font-bold text-white">
      !!
    </div>
  )
}

function BestMoveIcon() {
  return (
    <div className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#1a9850] text-[10px] font-bold text-white">
      ★
    </div>
  )
}

function UnlikelyGoodMoveIcon() {
  return (
    <>
      <div
        className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#2ca25f] text-[10px] font-bold text-white"
        data-tooltip-id="unlikely-good-tooltip"
      >
        !
      </div>
      <Tooltip
        id="unlikely-good-tooltip"
        content="Surprising Strong Move"
        place="top"
        delayShow={300}
        className="z-50 !bg-background-2 !px-2 !py-1 !text-xs"
      />
    </>
  )
}

export const MovesContainer: React.FC<Props> = (props) => {
  const {
    game,
    highlightIndices,
    termination,
    type,
    showAnnotations = true,
    showVariations = true,
  } = props
  const { isMobile } = useContext(WindowSizeContext)

  // Helper function to determine if move indicators should be shown
  const shouldShowIndicators = (node: GameNode | null) => {
    if (!node || !showAnnotations) return false

    // Calculate ply from start: (moveNumber - 1) * 2 + (turn === 'b' ? 1 : 0)
    const moveNumber = node.moveNumber
    const turn = node.turn
    const plyFromStart = (moveNumber - 1) * 2 + (turn === 'b' ? 1 : 0)

    // Only show indicators after the first 6 ply (moves 1, 2, and 3)
    return plyFromStart >= 6
  }

  const baseController = useBaseTreeController(type)

  const mainLineNodes = useMemo(() => {
    return baseController.gameTree.getMainLine() ?? game.tree.getMainLine()
  }, [game, type, baseController.gameTree, baseController.currentNode])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!baseController.currentNode) return

      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault()
          if (baseController.currentNode.mainChild) {
            baseController.goToNode(baseController.currentNode.mainChild)
          }
          break
        case 'ArrowLeft':
          event.preventDefault()
          if (baseController.currentNode.parent) {
            baseController.goToNode(baseController.currentNode.parent)
          }
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [baseController.currentNode, baseController.goToNode])

  const moves = useMemo(() => {
    const nodes = mainLineNodes.slice(1)
    const rows: (GameNode | null)[][] = []

    const firstNode = nodes[0]

    if (firstNode && firstNode.turn === 'w') {
      rows.push([null, firstNode])
      for (let i = 1; i < nodes.length; i += 2) {
        rows.push([nodes[i], nodes[i + 1]].filter(Boolean))
      }
    } else {
      return nodes.reduce((rows: (GameNode | null)[][], node, index) => {
        index % 2 === 0 ? rows.push([node]) : rows[rows.length - 1].push(node)
        return rows
      }, [])
    }

    return rows
  }, [mainLineNodes])

  const highlightSet = useMemo(
    () => new Set(highlightIndices ?? []),
    [highlightIndices],
  )

  interface MovePair {
    moveNumber: number
    whiteMove: GameNode | null
    blackMove: GameNode | null
  }

  const mobileMovePairs = useMemo(() => {
    if (!isMobile) return []

    const nodes = mainLineNodes.slice(1)
    const pairs: MovePair[] = []
    let currentPair: MovePair | null = null

    nodes.forEach((node) => {
      if (!currentPair) {
        currentPair = {
          moveNumber: node.moveNumber,
          whiteMove: null,
          blackMove: null,
        }
      } else {
        if (currentPair.moveNumber !== node.moveNumber) {
          pairs.push(currentPair)
          currentPair = {
            moveNumber: node.moveNumber,
            whiteMove: null,
            blackMove: null,
          }
        }
      }

      if (node.turn === 'b') {
        currentPair.whiteMove = node
      } else {
        currentPair.blackMove = node
      }
    })

    if (currentPair) {
      pairs.push(currentPair)
    }

    return pairs
  }, [mainLineNodes, isMobile])

  if (isMobile) {
    return (
      <div className="w-full overflow-x-auto px-2">
        <div className="flex flex-row items-center gap-1">
          {mobileMovePairs.map((pair, pairIndex) => (
            <React.Fragment key={pairIndex}>
              <div className="flex min-w-fit items-center rounded px-1 py-1 text-xs text-secondary">
                {pair.moveNumber}.{!pair.whiteMove ? '..' : ''}
              </div>
              {pair.whiteMove && (
                <div
                  onClick={() =>
                    baseController.goToNode(pair.whiteMove as GameNode)
                  }
                  className={`flex min-w-fit cursor-pointer flex-row items-center rounded px-2 py-1 text-sm ${
                    baseController.currentNode === pair.whiteMove
                      ? 'bg-human-4/20'
                      : 'hover:bg-background-2'
                  } ${highlightSet.has(pairIndex * 2 + 1) ? 'bg-human-3/80' : ''}`}
                >
                  <span>{pair.whiteMove.san ?? pair.whiteMove.move}</span>
                  {shouldShowIndicators(pair.whiteMove) &&
                    pair.whiteMove.blunder && <BlunderIcon />}
                  {shouldShowIndicators(pair.whiteMove) &&
                    pair.whiteMove.unlikelyGoodMove && <UnlikelyGoodMoveIcon />}
                </div>
              )}
              {pair.blackMove && (
                <div
                  onClick={() =>
                    baseController.goToNode(pair.blackMove as GameNode)
                  }
                  className={`flex min-w-fit cursor-pointer flex-row items-center rounded px-2 py-1 text-sm ${
                    baseController.currentNode === pair.blackMove
                      ? 'bg-human-4/20'
                      : 'hover:bg-background-2'
                  } ${highlightSet.has(pairIndex * 2 + 2) ? 'bg-human-3/80' : ''}`}
                >
                  <span>{pair.blackMove.san ?? pair.blackMove.move}</span>
                  {shouldShowIndicators(pair.blackMove) &&
                    pair.blackMove.blunder && <BlunderIcon />}
                  {shouldShowIndicators(pair.blackMove) &&
                    pair.blackMove.unlikelyGoodMove && <UnlikelyGoodMoveIcon />}
                </div>
              )}
            </React.Fragment>
          ))}
          {termination && (
            <div
              className="min-w-fit cursor-pointer border border-primary/10 bg-background-1/90 px-4 py-1 text-sm opacity-90"
              onClick={() =>
                baseController.goToNode(mainLineNodes[mainLineNodes.length - 1])
              }
            >
              {termination.result}
              {', '}
              {termination.winner !== 'none'
                ? `${termination.winner} is victorious`
                : 'draw'}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="red-scrollbar grid h-48 auto-rows-min grid-cols-5 overflow-y-auto overflow-x-hidden whitespace-nowrap rounded-sm bg-background-1/60 md:h-full md:w-full">
      {moves.map(([whiteNode, blackNode], index) => {
        return (
          <>
            <span className="flex h-7 items-center justify-center bg-background-2 text-sm text-secondary">
              {(whiteNode || blackNode)?.moveNumber}
            </span>
            <div
              onClick={() => {
                if (whiteNode) baseController.goToNode(whiteNode)
              }}
              data-index={index * 2 + 1}
              className={`col-span-2 flex h-7 flex-1 cursor-pointer flex-row items-center justify-between px-2 text-sm hover:bg-background-2 ${baseController.currentNode === whiteNode && 'bg-human-4/20'} ${highlightSet.has(index * 2 + 1) && 'bg-human-3/80'}`}
            >
              {whiteNode?.san ?? whiteNode?.move}
              {shouldShowIndicators(whiteNode) && whiteNode?.blunder && (
                <BlunderIcon />
              )}
              {shouldShowIndicators(whiteNode) &&
                whiteNode?.unlikelyGoodMove && <UnlikelyGoodMoveIcon />}
            </div>
            {showVariations && whiteNode?.getVariations().length ? (
              <FirstVariation
                color="white"
                node={whiteNode}
                currentNode={baseController.currentNode}
                goToNode={baseController.goToNode}
                showAnnotations={showAnnotations}
              />
            ) : null}
            <div
              onClick={() => {
                if (blackNode) baseController.goToNode(blackNode)
              }}
              data-index={index * 2 + 2}
              className={`col-span-2 flex h-7 flex-1 cursor-pointer flex-row items-center justify-between px-2 text-sm hover:bg-background-2 ${baseController.currentNode === blackNode && 'bg-human-4/20'} ${highlightSet.has(index * 2 + 2) && 'bg-human-3/80'}`}
            >
              {blackNode?.san ?? blackNode?.move}
              {shouldShowIndicators(blackNode) && blackNode?.blunder && (
                <BlunderIcon />
              )}
              {shouldShowIndicators(blackNode) &&
                blackNode?.unlikelyGoodMove && <UnlikelyGoodMoveIcon />}
            </div>
            {showVariations && blackNode?.getVariations().length ? (
              <FirstVariation
                color="black"
                node={blackNode}
                currentNode={baseController.currentNode}
                goToNode={baseController.goToNode}
                showAnnotations={showAnnotations}
              />
            ) : null}
          </>
        )
      })}
      {termination && !isMobile && (
        <div
          className="col-span-5 cursor-pointer rounded-sm border border-primary/10 bg-background-1/90 p-5 text-center opacity-90"
          onClick={() =>
            baseController.goToNode(mainLineNodes[mainLineNodes.length - 1])
          }
        >
          {termination.result}
          {', '}
          {termination.winner !== 'none'
            ? `${termination.winner} is victorious`
            : 'draw'}
        </div>
      )}
    </div>
  )
}

function FirstVariation({
  node,
  color,
  currentNode,
  goToNode,
  showAnnotations,
}: {
  node: GameNode
  color: 'white' | 'black'
  currentNode: GameNode | undefined
  goToNode: (node: GameNode) => void
  showAnnotations: boolean
}) {
  return (
    <>
      {color === 'white' ? <div className="col-span-2"></div> : null}
      <div className="col-span-5 py-1">
        <ul className="root list-none pl-6">
          {node.getVariations().map((n) => (
            <VariationTree
              key={n.move}
              node={n}
              currentNode={currentNode}
              goToNode={goToNode}
              level={0}
              showAnnotations={showAnnotations}
            />
          ))}
        </ul>
      </div>
      {color === 'white' ? <div className="col-span-3"></div> : null}
    </>
  )
}

function VariationTree({
  node,
  currentNode,
  goToNode,
  level,
  showAnnotations,
}: {
  node: GameNode
  currentNode: GameNode | undefined
  goToNode: (node: GameNode) => void
  level: number
  showAnnotations: boolean
}) {
  const variations = node.getVariations()

  // Helper function to determine if move indicators should be shown in variations
  const shouldShowVariationIndicators = (node: GameNode) => {
    if (!showAnnotations) return false
    const moveNumber = node.moveNumber
    const turn = node.turn
    const plyFromStart = (moveNumber - 1) * 2 + (turn === 'b' ? 1 : 0)
    return plyFromStart >= 6
  }
  return (
    <li className={`tree-li ${level === 0 ? 'no-tree-connector' : ''}`}>
      <span
        onClick={() => goToNode(node)}
        className={`cursor-pointer px-0.5 text-xs ${
          currentNode?.fen === node?.fen
            ? 'rounded bg-human-4/50 text-primary'
            : 'text-secondary'
        }`}
      >
        {node.moveNumber}. {node.turn === 'w' ? '...' : ''}
        {node.san}
        <span className="inline-flex items-center">
          {shouldShowVariationIndicators(node) && node.blunder && (
            <span
              className="ml-0.5 text-[8px] text-[#d73027]"
              data-tooltip-id="variation-blunder-tooltip"
            >
              !
            </span>
          )}
          {shouldShowVariationIndicators(node) && node.unlikelyGoodMove && (
            <span
              className="ml-0.5 text-[8px] text-[#2ca25f]"
              data-tooltip-id="variation-unlikely-tooltip"
            >
              !?
            </span>
          )}
        </span>
      </span>
      {variations.length === 1 ? (
        <span className="inline">
          <InlineChain
            node={node}
            currentNode={currentNode}
            goToNode={goToNode}
            level={level}
            showAnnotations={showAnnotations}
          />
        </span>
      ) : variations.length > 1 ? (
        <ul className="tree-ul list-none">
          {variations.map((child) => (
            <VariationTree
              key={child.move}
              node={child}
              currentNode={currentNode}
              goToNode={goToNode}
              level={level + 1}
              showAnnotations={showAnnotations}
            />
          ))}
        </ul>
      ) : null}
      <Tooltip
        id="variation-blunder-tooltip"
        content="Critical Mistake"
        place="top"
        delayShow={300}
        className="z-50 !bg-background-2 !px-2 !py-1 !text-xs"
      />
      <Tooltip
        id="variation-unlikely-tooltip"
        content="Surprising Strong Move"
        place="top"
        delayShow={300}
        className="z-50 !bg-background-2 !px-2 !py-1 !text-xs"
      />
    </li>
  )
}

function InlineChain({
  node,
  currentNode,
  goToNode,
  level,
  showAnnotations,
}: {
  node: GameNode
  currentNode: GameNode | undefined
  goToNode: (node: GameNode) => void
  level: number
  showAnnotations: boolean
}) {
  const chain: GameNode[] = []
  let current = node

  // Helper function to determine if move indicators should be shown in inline chains
  const shouldShowInlineIndicators = (node: GameNode) => {
    if (!showAnnotations) return false
    const moveNumber = node.moveNumber
    const turn = node.turn
    const plyFromStart = (moveNumber - 1) * 2 + (turn === 'b' ? 1 : 0)
    return plyFromStart >= 6
  }

  while (current.getVariations().length === 1) {
    const child = current.getVariations()[0]
    chain.push(child)
    current = child
  }

  return (
    <>
      <span className="inline whitespace-normal break-words">
        {chain.map((child, index) => (
          <Fragment key={child.move}>
            <span
              onClick={() => goToNode(child)}
              className={`cursor-pointer px-0.5 text-xs ${
                currentNode?.fen === child?.fen
                  ? 'rounded bg-human-4/50 text-primary'
                  : 'text-secondary'
              }`}
            >
              {child.moveNumber}. {child.turn === 'w' ? '...' : ''}
              {child.san}
              <span className="inline-flex items-center">
                {shouldShowInlineIndicators(child) && child.blunder && (
                  <span
                    className="ml-0.5 text-[8px] text-[#d73027]"
                    data-tooltip-id="inline-blunder-tooltip"
                  >
                    !
                  </span>
                )}
                {shouldShowInlineIndicators(child) &&
                  child.unlikelyGoodMove && (
                    <span
                      className="ml-0.5 text-[8px] text-[#2ca25f]"
                      data-tooltip-id="inline-unlikely-tooltip"
                    >
                      !?
                    </span>
                  )}
              </span>
            </span>
          </Fragment>
        ))}
      </span>
      <Tooltip
        id="inline-blunder-tooltip"
        content="Critical Mistake"
        place="top"
        delayShow={300}
        className="z-50 !bg-background-2 !px-2 !py-1 !text-xs"
      />
      <Tooltip
        id="inline-unlikely-tooltip"
        content="Surprising Strong Move"
        place="top"
        delayShow={300}
        className="z-50 !bg-background-2 !px-2 !py-1 !text-xs"
      />
      {current.getVariations().length > 1 && (
        <ul className="tree-ul list-none">
          {current.getVariations().map((child) => (
            <VariationTree
              key={child.move}
              node={child}
              currentNode={currentNode}
              goToNode={goToNode}
              level={level + 1}
              showAnnotations={showAnnotations}
            />
          ))}
        </ul>
      )}
    </>
  )
}
