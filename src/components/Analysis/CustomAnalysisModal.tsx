import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Chess } from 'chess.ts'
import toast from 'react-hot-toast'

interface Props {
  onSubmit: (type: 'pgn' | 'fen', data: string, name?: string) => void
  onClose: () => void
}

export const CustomAnalysisModal: React.FC<Props> = ({ onSubmit, onClose }) => {
  const [mode, setMode] = useState<'pgn' | 'fen'>('pgn')
  const [input, setInput] = useState('')
  const [name, setName] = useState('')

  const validateAndSubmit = () => {
    if (!input.trim()) {
      toast.error('Please enter some data')
      return
    }

    if (mode === 'fen') {
      const chess = new Chess()
      const validation = chess.validateFen(input.trim())
      if (!validation.valid) {
        toast.error('Invalid FEN position: ' + validation.error)
        return
      }
    } else {
      try {
        const chess = new Chess()
        chess.loadPgn(input.trim())
      } catch (error) {
        toast.error('Invalid PGN format: ' + (error as Error).message)
        return
      }
    }

    onSubmit(mode, input.trim(), name.trim() || undefined)
  }

  const examplePGN = `1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Bb7 10. d4 Re8`
  const exampleFEN = `r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4`

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="absolute inset-0 z-50 flex items-center justify-center px-4 sm:px-6"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-backdrop/80 backdrop-blur-md" />
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="border-glass-border relative z-10 flex h-[550px] w-full max-w-[620px] flex-col overflow-hidden rounded-md border bg-glass backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 90% 70% at 50% 0%, rgba(239, 68, 68, 0.12) 0%, transparent 65%)',
            }}
          />
          <div className="relative z-10 flex h-full flex-col">
            {/* Header */}
            <div className="border-glass-border relative border-b px-5 py-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-white/95">
                  Custom Analysis
                </h2>
                <p className="text-xs text-white/70">
                  Import a chess game from PGN notation or analyze a specific
                  position using FEN notation
                </p>
              </div>
              <button
                className="absolute right-4 top-4 text-white/60 transition-colors hover:text-white"
                title="Close"
                onClick={onClose}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-5">
                {/* Mode selector */}
                <div>
                  <label
                    htmlFor="import-type-selector"
                    className="mb-1 block text-sm font-medium text-white/80"
                  >
                    Import Type:
                  </label>
                  <div id="import-type-selector" className="flex gap-2">
                    <button
                      className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-all ${
                        mode === 'pgn'
                          ? 'border-transparent bg-glass-strong text-white hover:bg-glass-stronger'
                          : 'border-glass-border bg-glass text-white/80 hover:bg-glass-stronger'
                      }`}
                      onClick={() => setMode('pgn')}
                    >
                      PGN Game
                    </button>
                    <button
                      className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-all ${
                        mode === 'fen'
                          ? 'border-transparent bg-glass-strong text-white hover:bg-glass-stronger'
                          : 'border-glass-border bg-glass text-white/80 hover:bg-glass-stronger'
                      }`}
                      onClick={() => setMode('fen')}
                    >
                      FEN Position
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="analysis-name"
                    className="mb-1 block text-sm font-medium text-white/80"
                  >
                    Name (optional):
                  </label>
                  <input
                    id="analysis-name"
                    type="text"
                    className="border-glass-border w-full rounded-md border bg-glass px-3 py-2 text-sm text-white/90 placeholder-white/40 focus:border-white/40 focus:outline-none"
                    placeholder="Enter a name for this analysis"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label
                    htmlFor="analysis-data"
                    className="mb-1 block text-sm font-medium text-white/80"
                  >
                    {mode === 'pgn' ? 'PGN Data:' : 'FEN Position:'}
                  </label>
                  <textarea
                    id="analysis-data"
                    className="border-glass-border h-32 w-full rounded-md border bg-glass px-3 py-2 font-mono text-sm text-white/90 placeholder-white/40 focus:border-white/40 focus:outline-none"
                    placeholder={mode === 'pgn' ? examplePGN : exampleFEN}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-white/60">
                    {mode === 'pgn'
                      ? 'Paste your PGN game notation here. Headers and variations are supported.'
                      : 'Enter a valid FEN position string. This will set up the board for analysis.'}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    className="border-glass-border rounded-md border bg-glass px-3 py-1.5 text-xs text-white/80 transition-colors hover:bg-glass-stronger"
                    onClick={() =>
                      setInput(mode === 'pgn' ? examplePGN : exampleFEN)
                    }
                  >
                    Use Example
                  </button>
                  <button
                    className="border-glass-border rounded-md border bg-glass px-3 py-1.5 text-xs text-white/80 transition-colors hover:bg-glass-stronger"
                    onClick={() => setInput('')}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="border-glass-border flex gap-3 border-t px-5 py-4">
              <button
                className="border-glass-border flex-1 rounded-md border bg-glass px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-glass-stronger"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="border-glass-border flex-1 rounded-md border bg-glass-strong px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-glass-stronger"
                onClick={validateAndSubmit}
              >
                Analyze
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  )
}
