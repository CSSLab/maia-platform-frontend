import React, { useState, useMemo } from 'react'
import { MAIA_MODELS_WITH_NAMES } from 'src/constants/common'
import { GameBoard } from 'src/components/Board'
import { GameNode } from 'src/types'

interface DrillFromPositionConfig {
  maiaVersion: string
  targetMoveNumber: number
  drillCount: number
  playerColor: 'white' | 'black'
  position: {
    fen: string
    turn: string
    pgn: string
  }
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: (config: DrillFromPositionConfig) => void
  currentNode: GameNode
  initialPgn: string
}

export const DrillFromPositionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  currentNode,
  initialPgn,
}) => {
  // Initialize with detected player color from current position
  const playerColor = useMemo(() => {
    return currentNode.turn === 'w' ? 'white' : 'black'
  }, [currentNode.turn])

  const [selectedMaiaVersion, setSelectedMaiaVersion] = useState(
    MAIA_MODELS_WITH_NAMES[4], // Default to Maia 1500
  )
  const [targetMoveNumber, setTargetMoveNumber] = useState(10)
  const [drillCount, setDrillCount] = useState(3)

  const handleConfirm = () => {
    const config: DrillFromPositionConfig = {
      maiaVersion: selectedMaiaVersion.id,
      targetMoveNumber,
      drillCount,
      playerColor,
      position: {
        fen: currentNode.fen,
        turn: currentNode.turn || 'w',
        pgn: initialPgn,
      },
    }
    onConfirm(config)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative flex h-[90vh] max-h-[700px] w-[95vw] max-w-[900px] flex-col overflow-hidden rounded-lg bg-background-1 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div>
            <h2 className="text-xl font-bold text-primary">
              Configure Drill from Position
            </h2>
            <p className="mt-1 text-sm text-secondary">
              Set up your practice session from the current analysis position
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-2 text-secondary transition-colors hover:bg-white/10 hover:text-primary"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Configuration Options */}
          <div className="flex w-1/2 flex-col border-r border-white/10 p-4">
            <div className="space-y-6">
              {/* Maia Engine Strength */}
              <div>
                <label
                  htmlFor="maia-strength"
                  className="mb-2 block text-sm font-medium text-primary"
                >
                  Maia Engine Strength
                </label>
                <select
                  id="maia-strength"
                  value={selectedMaiaVersion.id}
                  onChange={(e) => {
                    const version = MAIA_MODELS_WITH_NAMES.find(
                      (v) => v.id === e.target.value,
                    )
                    if (version) {
                      setSelectedMaiaVersion(version)
                    }
                  }}
                  className="w-full rounded bg-background-2 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-human-4"
                >
                  {MAIA_MODELS_WITH_NAMES.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-secondary">
                  Choose the AI opponent strength (1100-1900 rating)
                </p>
              </div>

              {/* Target Move Count */}
              <div>
                <label
                  htmlFor="target-moves"
                  className="mb-2 block text-sm font-medium text-primary"
                >
                  Moves per Drill: {targetMoveNumber}
                </label>
                <input
                  id="target-moves"
                  type="range"
                  min="5"
                  max="20"
                  value={targetMoveNumber}
                  onChange={(e) =>
                    setTargetMoveNumber(parseInt(e.target.value))
                  }
                  className="w-full accent-human-4"
                />
                <div className="mt-1 flex justify-between text-xs text-secondary">
                  <span>5 moves</span>
                  <span>20 moves</span>
                </div>
                <p className="mt-1 text-xs text-secondary">
                  How many moves to play in each drill session
                </p>
              </div>

              {/* Number of Drills */}
              <div>
                <label
                  htmlFor="drill-count"
                  className="mb-2 block text-sm font-medium text-primary"
                >
                  Number of Drills: {drillCount}
                </label>
                <input
                  id="drill-count"
                  type="range"
                  min="1"
                  max="10"
                  value={drillCount}
                  onChange={(e) => setDrillCount(parseInt(e.target.value))}
                  className="w-full accent-human-4"
                />
                <div className="mt-1 flex justify-between text-xs text-secondary">
                  <span>1 drill</span>
                  <span>10 drills</span>
                </div>
                <p className="mt-1 text-xs text-secondary">
                  Total number of practice sessions from this position
                </p>
              </div>

              {/* Player Color Info */}
              <div className="rounded bg-background-2/50 p-3">
                <h4 className="mb-2 text-xs font-medium text-primary">
                  Player Color
                </h4>
                <div className="flex items-center gap-2 text-sm">
                  <div
                    className={`h-4 w-4 rounded border ${
                      playerColor === 'white'
                        ? 'border-gray-400 bg-white'
                        : 'border-gray-400 bg-gray-800'
                    }`}
                  ></div>
                  <span className="text-primary">
                    Playing as {playerColor} (to move in this position)
                  </span>
                </div>
                <p className="mt-1 text-xs text-secondary">
                  You&apos;ll practice from this position as the player to move
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-auto flex gap-3 pt-6">
              <button
                onClick={onClose}
                className="flex-1 rounded bg-background-2 py-2 text-sm font-medium transition-colors hover:bg-background-3"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 rounded bg-human-4 py-2 text-sm font-medium text-background-1 transition-colors hover:bg-human-4/80"
              >
                Start Drilling
              </button>
            </div>
          </div>

          {/* Right Panel - Position Preview */}
          <div className="flex w-1/2 flex-col p-4">
            <h3 className="mb-3 text-sm font-medium text-primary">
              Position Preview
            </h3>
            {/* Board Container */}
            <div className="flex flex-1 items-center justify-center">
              <div className="aspect-square w-full max-w-[320px]">
                <GameBoard
                  currentNode={currentNode}
                  orientation={playerColor}
                  availableMoves={new Map()} // No moves in preview mode
                  shapes={[]} // No shapes in preview mode
                />
              </div>
            </div>

            {/* Position Info */}
            <div className="mt-4 space-y-2 text-xs text-secondary">
              <div className="flex justify-between">
                <span>Position:</span>
                <span className="font-mono text-xs">
                  {currentNode.fen.split(' ').slice(0, 2).join(' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>To move:</span>
                <span className="capitalize">
                  {currentNode.turn === 'w' ? 'White' : 'Black'}
                </span>
              </div>
              {currentNode.san && (
                <div className="flex justify-between">
                  <span>Last move:</span>
                  <span className="font-mono">{currentNode.san}</span>
                </div>
              )}
            </div>

            {/* Drill Summary */}
            <div className="mt-4 rounded bg-background-2/50 p-3">
              <h4 className="mb-2 text-xs font-medium text-primary">
                Drill Summary
              </h4>
              <div className="space-y-1 text-xs text-secondary">
                <div>
                  • Play as {playerColor} against {selectedMaiaVersion.name}
                </div>
                <div>• {targetMoveNumber} moves per drill session</div>
                <div>
                  • {drillCount} total drill{drillCount !== 1 ? 's' : ''}
                </div>
                <div>• Practice from current analysis position</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
