/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { GameNode, Termination, BaseGame } from 'src/types'
import { TreeControllerContext, WindowSizeContext } from 'src/contexts'
import { MoveClassificationIcon } from 'src/components/Common/MoveIcons'
import React, { useContext, useMemo, Fragment, useEffect, useRef } from 'react'

interface Props {
  game: BaseGame
  highlightIndices?: number[]
  termination?: Termination
  showAnnotations?: boolean
  showVariations?: boolean
  disableKeyboardNavigation?: boolean
  disableMoveClicking?: boolean
  startFromNode?: GameNode
  restrictNavigationBefore?: GameNode
}

const getMoveClassification = (node: GameNode | null) => {
  if (!node) {
    return {
      blunder: false,
      inaccuracy: false,
      excellent: false,
      bestMove: false,
    }
  }

  return {
    blunder: node.blunder,
    inaccuracy: node.inaccuracy,
    excellent: node.excellentMove,
    bestMove: node.bestMove,
  }
}

export const MovesContainer: React.FC<
  Props & { embedded?: boolean; heightClass?: string }
> = (props) => {
  const {
    game,
    termination,
    highlightIndices,
    showAnnotations = true,
    showVariations = true,
    disableKeyboardNavigation = false,
    disableMoveClicking = false,
    startFromNode,
    restrictNavigationBefore,
    embedded = true,
    heightClass = 'h-48',
  } = props as Props & { embedded?: boolean; heightClass?: string }
  const { isMobile } = useContext(WindowSizeContext)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentMoveRef = useRef<HTMLDivElement>(null)

  const shouldShowIndicators = (node: GameNode | null) => {
    if (!node || !showAnnotations) return false

    const moveNumber = node.moveNumber
    const turn = node.turn
    const plyFromStart = (moveNumber - 1) * 2 + (turn === 'b' ? 1 : 0)

    return plyFromStart >= 6
  }

  const controller = useContext(TreeControllerContext)

  const mainLineNodes = useMemo(() => {
    const fullMainLine =
      controller.gameTree?.getMainLine() ?? game.tree?.getMainLine() ?? []

    if (startFromNode) {
      // Find the index of the start node in the full main line
      const startIndex = fullMainLine.findIndex(
        (node) => node.fen === startFromNode.fen,
      )

      if (startIndex !== -1) {
        // Return the main line starting from the specified node
        const customMainLine = fullMainLine.slice(startIndex)
        console.log('MovesContainer mainLineNodes (custom start):', {
          fullMainLineLength: fullMainLine.length,
          startIndex,
          customMainLineLength: customMainLine.length,
          startNodeFen: startFromNode.fen,
          currentNode: controller.currentNode?.fen,
        })
        return customMainLine
      } else {
        // If start node not found in main line, build from start node
        const customMainLine = [startFromNode]
        let current = startFromNode.mainChild
        while (current) {
          customMainLine.push(current)
          current = current.mainChild
        }
        console.log('MovesContainer mainLineNodes (built from start):', {
          customMainLineLength: customMainLine.length,
          startNodeFen: startFromNode.fen,
          currentNode: controller.currentNode?.fen,
        })
        return customMainLine
      }
    }

    console.log('MovesContainer mainLineNodes (default):', {
      controllerTreeMainLine: controller.gameTree?.getMainLine()?.length || 0,
      gameTreeMainLine: game?.tree?.getMainLine()?.length || 0,
      finalMainLineLength: fullMainLine?.length || 0,
      currentNode: controller.currentNode?.fen,
    })
    return fullMainLine
  }, [game, controller.gameTree, controller.currentNode, startFromNode])

  useEffect(() => {
    if (disableKeyboardNavigation) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!controller.currentNode) return

      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault()
          if (controller.currentNode.mainChild) {
            controller.goToNode(controller.currentNode.mainChild)
          }
          break
        case 'ArrowLeft':
          event.preventDefault()
          if (controller.currentNode.parent) {
            // Check if navigation is restricted
            if (
              restrictNavigationBefore &&
              controller.currentNode.parent.fen === restrictNavigationBefore.fen
            ) {
              // Don't navigate before the restriction point
              return
            }
            controller.goToNode(controller.currentNode.parent)
          }
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    controller.currentNode,
    controller.goToNode,
    disableKeyboardNavigation,
    restrictNavigationBefore,
  ])

  useEffect(() => {
    if (currentMoveRef.current && containerRef.current) {
      currentMoveRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      })
    }
  }, [controller.currentNode])

  const moves = useMemo(() => {
    // When using startFromNode, we want to show moves AFTER that node
    // When using default behavior, we want to skip the root node (slice(1))
    const nodes = startFromNode
      ? mainLineNodes.slice(1)
      : mainLineNodes.slice(1)
    console.log('MovesContainer moves calculation:', {
      mainLineNodesLength: mainLineNodes.length,
      nodesAfterSliceLength: nodes.length,
      firstNodeTurn: nodes[0]?.turn,
      startFromNode: startFromNode?.fen,
      allNodes: nodes.map((n, i) => ({
        index: i,
        move: n?.san,
        turn: n?.turn,
      })),
    })

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

    console.log('MovesContainer final rows:', rows.length)
    return rows
  }, [mainLineNodes, startFromNode])

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

    // Use the same logic as the moves calculation for consistency
    const nodes = startFromNode
      ? mainLineNodes.slice(1)
      : mainLineNodes.slice(1)
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
      <div ref={containerRef} className="w-full overflow-x-auto px-2">
        <div className="flex flex-row items-center gap-1">
          {mobileMovePairs.map((pair, pairIndex) => (
            <React.Fragment key={pairIndex}>
              <div className="flex min-w-fit items-center rounded px-1 py-1 text-xs text-white/70">
                {pair.moveNumber}.{!pair.whiteMove ? '..' : ''}
              </div>
              {pair.whiteMove && (
                <div
                  ref={
                    controller.currentNode === pair.whiteMove
                      ? currentMoveRef
                      : null
                  }
                  onClick={() => {
                    if (!disableMoveClicking) {
                      controller.goToNode(pair.whiteMove as GameNode)
                    }
                  }}
                  className={`flex min-w-fit cursor-pointer flex-row items-center rounded-md px-2 py-1 text-sm ${
                    controller.currentNode === pair.whiteMove
                      ? 'bg-white/10'
                      : 'hover:bg-white/10'
                  } ${highlightSet.has(pairIndex * 2 + 1) ? 'bg-white/15' : ''}`}
                >
                  <span
                    style={{
                      color: showAnnotations
                        ? pair.whiteMove.color || 'inherit'
                        : 'inherit',
                    }}
                  >
                    {pair.whiteMove.san ?? pair.whiteMove.move}
                  </span>
                  {shouldShowIndicators(pair.whiteMove) && (
                    <MoveClassificationIcon
                      classification={getMoveClassification(pair.whiteMove)}
                      size="medium"
                      onClick={() => {
                        if (pair.whiteMove?.parent) {
                          controller.goToNode(pair.whiteMove.parent)
                        }
                      }}
                    />
                  )}
                </div>
              )}
              {pair.blackMove && (
                <div
                  ref={
                    controller.currentNode === pair.blackMove
                      ? currentMoveRef
                      : null
                  }
                  onClick={() => {
                    if (!disableMoveClicking) {
                      controller.goToNode(pair.blackMove as GameNode)
                    }
                  }}
                  className={`flex min-w-fit cursor-pointer flex-row items-center rounded-md px-2 py-1 text-sm ${
                    controller.currentNode === pair.blackMove
                      ? 'bg-white/10'
                      : 'hover:bg-white/10'
                  } ${highlightSet.has(pairIndex * 2 + 2) ? 'bg-white/15' : ''}`}
                >
                  <span
                    style={{
                      color: showAnnotations
                        ? pair.blackMove.color || 'inherit'
                        : 'inherit',
                    }}
                  >
                    {pair.blackMove.san ?? pair.blackMove.move}
                  </span>
                  {shouldShowIndicators(pair.blackMove) && (
                    <MoveClassificationIcon
                      classification={getMoveClassification(pair.blackMove)}
                      size="medium"
                      onClick={() => {
                        if (pair.blackMove?.parent) {
                          controller.goToNode(pair.blackMove.parent)
                        }
                      }}
                    />
                  )}
                </div>
              )}
            </React.Fragment>
          ))}
          {termination && (
            <div
              className="min-w-fit cursor-pointer border-b border-t border-white/10 bg-[rgb(var(--color-surface-2))] px-4 py-1 text-sm text-white/90"
              onClick={() => {
                if (!disableMoveClicking) {
                  controller.goToNode(mainLineNodes[mainLineNodes.length - 1])
                }
              }}
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
    <div
      ref={containerRef}
      className={`red-scrollbar grid ${heightClass} w-full max-w-full auto-rows-min grid-cols-[2.5rem_1fr_1fr_1fr_1fr] overflow-y-auto overflow-x-hidden whitespace-nowrap text-white/90 md:h-full ${
        embedded ? 'bg-transparent' : 'bg-transparent'
      }`}
    >
      {moves.map(([whiteNode, blackNode], index) => {
        return (
          <>
            <span className="flex h-7 items-center justify-center bg-glass-strong text-sm text-white/70">
              {(whiteNode || blackNode)?.moveNumber}
            </span>
            <div
              ref={controller.currentNode === whiteNode ? currentMoveRef : null}
              onClick={() => {
                if (whiteNode && !disableMoveClicking) {
                  controller.goToNode(whiteNode)
                }
              }}
              data-index={index * 2 + 1}
              className={`col-span-2 flex h-7 min-w-0 flex-1 cursor-pointer flex-row items-center justify-between px-2 text-sm hover:bg-glass-hover ${controller.currentNode === whiteNode && 'bg-glass-strong'} ${highlightSet.has(index * 2 + 1) && 'bg-glass-strong'}`}
            >
              <span
                style={{
                  color: showAnnotations
                    ? whiteNode?.color || 'inherit'
                    : 'inherit',
                }}
                className="truncate"
              >
                {whiteNode?.san ?? whiteNode?.move}
              </span>
              {shouldShowIndicators(whiteNode) && (
                <MoveClassificationIcon
                  classification={getMoveClassification(whiteNode)}
                  size="medium"
                  onClick={() => {
                    if (whiteNode?.parent) {
                      controller.goToNode(whiteNode.parent)
                    }
                  }}
                />
              )}
            </div>
            {showVariations && whiteNode?.getVariations().length ? (
              <FirstVariation
                color="white"
                node={whiteNode}
                currentNode={controller.currentNode}
                goToNode={controller.goToNode}
                showAnnotations={showAnnotations}
                disableMoveClicking={disableMoveClicking}
              />
            ) : null}
            <div
              ref={controller.currentNode === blackNode ? currentMoveRef : null}
              onClick={() => {
                if (blackNode && !disableMoveClicking) {
                  controller.goToNode(blackNode)
                }
              }}
              data-index={index * 2 + 2}
              className={`col-span-2 flex h-7 min-w-0 flex-1 cursor-pointer flex-row items-center justify-between px-2 text-sm hover:bg-glass-hover ${controller.currentNode === blackNode && 'bg-glass-strong'} ${highlightSet.has(index * 2 + 2) && 'bg-glass-strong'}`}
            >
              <span
                style={{
                  color: showAnnotations
                    ? blackNode?.color || 'inherit'
                    : 'inherit',
                }}
                className="truncate"
              >
                {blackNode?.san ?? blackNode?.move}
              </span>
              {shouldShowIndicators(blackNode) && (
                <MoveClassificationIcon
                  classification={getMoveClassification(blackNode)}
                  size="medium"
                  onClick={() => {
                    if (blackNode?.parent) {
                      controller.goToNode(blackNode.parent)
                    }
                  }}
                />
              )}
            </div>
            {showVariations && blackNode?.getVariations().length ? (
              <FirstVariation
                color="black"
                node={blackNode}
                currentNode={controller.currentNode}
                goToNode={controller.goToNode}
                showAnnotations={showAnnotations}
                disableMoveClicking={disableMoveClicking}
              />
            ) : null}
          </>
        )
      })}
      {termination && !isMobile && (
        <div
          className="col-span-5 cursor-pointer border-b border-t border-glassBorder bg-glass p-5 text-center text-white/90 backdrop-blur-md"
          onClick={() => {
            if (!disableMoveClicking) {
              controller.goToNode(mainLineNodes[mainLineNodes.length - 1])
            }
          }}
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
  disableMoveClicking = false,
}: {
  node: GameNode
  color: 'white' | 'black'
  currentNode: GameNode | undefined
  goToNode: (node: GameNode) => void
  showAnnotations: boolean
  disableMoveClicking?: boolean
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
              disableMoveClicking={disableMoveClicking}
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
  disableMoveClicking = false,
}: {
  node: GameNode
  currentNode: GameNode | undefined
  goToNode: (node: GameNode) => void
  level: number
  showAnnotations: boolean
  disableMoveClicking?: boolean
}) {
  const variations = node.getVariations()

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
        onClick={() => {
          if (!disableMoveClicking) {
            goToNode(node)
          }
        }}
        className={`cursor-pointer px-0.5 text-xs ${
          currentNode?.fen === node?.fen
            ? 'rounded bg-human-4/20 text-primary'
            : 'text-secondary'
        }`}
        style={{ color: showAnnotations ? node.color || 'inherit' : 'inherit' }}
      >
        {node.moveNumber}. {node.turn === 'w' ? '...' : ''}
        <span>{node.san}</span>
        <span className="inline-flex items-center">
          {shouldShowVariationIndicators(node) && (
            <MoveClassificationIcon
              classification={getMoveClassification(node)}
              size="small"
              className="ml-0.5"
              onClick={() => {
                if (node.parent) {
                  goToNode(node.parent)
                }
              }}
            />
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
            disableMoveClicking={disableMoveClicking}
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
              disableMoveClicking={disableMoveClicking}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function InlineChain({
  node,
  currentNode,
  goToNode,
  level,
  showAnnotations,
  disableMoveClicking = false,
}: {
  node: GameNode
  currentNode: GameNode | undefined
  goToNode: (node: GameNode) => void
  level: number
  showAnnotations: boolean
  disableMoveClicking?: boolean
}) {
  const chain: GameNode[] = []
  let current = node

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
        {chain.map((child) => (
          <Fragment key={child.move}>
            <span
              onClick={() => {
                if (!disableMoveClicking) {
                  goToNode(child)
                }
              }}
              className={`cursor-pointer px-0.5 text-xs ${
                currentNode?.fen === child?.fen
                  ? 'rounded bg-human-4/50 text-primary'
                  : 'text-secondary'
              }`}
              style={{
                color: showAnnotations ? child.color || 'inherit' : 'inherit',
              }}
            >
              {child.moveNumber}. {child.turn === 'w' ? '...' : ''}
              <span>{child.san}</span>
              <span className="inline-flex items-center">
                {shouldShowInlineIndicators(child) && (
                  <MoveClassificationIcon
                    classification={getMoveClassification(child)}
                    size="small"
                    className="ml-0.5"
                    onClick={() => {
                      if (child.parent) {
                        goToNode(child.parent)
                      }
                    }}
                  />
                )}
              </span>
            </span>
          </Fragment>
        ))}
      </span>
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
              disableMoveClicking={disableMoveClicking}
            />
          ))}
        </ul>
      )}
    </>
  )
}
