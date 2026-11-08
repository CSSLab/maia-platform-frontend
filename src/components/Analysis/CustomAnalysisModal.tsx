import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Chess } from 'chess.ts'
import toast from 'react-hot-toast'

import { fetchLichessStudyPgn } from 'src/api/lichess'
import { checkStartPosition } from 'src/lib/startPosition'
import {
  LichessStudyChapter,
  lichessStudyChapterTitle,
  parseLichessStudyChapters,
  parseLichessStudyUrl,
} from 'src/lib/lichessStudy'

const PGN_HEADER_LINE_REGEX = /^\s*\[[^\]]+\]\s*$/

const ensureBlankLineAfterPgnHeaders = (pgn: string): string => {
  const normalizedNewlines = pgn.replace(/\r\n/g, '\n')
  const lines = normalizedNewlines.split('\n')

  let firstContentLine = 0
  while (
    firstContentLine < lines.length &&
    lines[firstContentLine].trim().length === 0
  ) {
    firstContentLine++
  }

  let headerEndLine = firstContentLine
  while (
    headerEndLine < lines.length &&
    PGN_HEADER_LINE_REGEX.test(lines[headerEndLine])
  ) {
    headerEndLine++
  }

  const hasHeaderBlock = headerEndLine > firstContentLine
  const hasMovetextAfterHeaders = headerEndLine < lines.length
  const needsSeparator =
    hasHeaderBlock &&
    hasMovetextAfterHeaders &&
    lines[headerEndLine].trim().length > 0

  if (needsSeparator) {
    lines.splice(headerEndLine, 0, '')
  }

  return lines.join('\n')
}

const isValidPgn = (pgn: string) =>
  Array.from(new Set([pgn, ensureBlankLineAfterPgnHeaders(pgn)])).some(
    (candidate) => new Chess().loadPgn(candidate, { sloppy: true }),
  )

interface Props {
  onSubmit: (type: 'pgn' | 'fen', data: string, name?: string) => void
  onClose: () => void
}

type Mode = 'pgn' | 'fen' | 'study'

// A study's chapters once loaded, with the link they came from.
interface LoadedStudy {
  url: string
  chapters: LichessStudyChapter[]
}

export const CustomAnalysisModal: React.FC<Props> = ({ onSubmit, onClose }) => {
  const [mode, setMode] = useState<Mode>('pgn')
  const [input, setInput] = useState('')
  const [studyUrl, setStudyUrl] = useState('')
  const [name, setName] = useState('')
  const [study, setStudy] = useState<LoadedStudy | null>(null)
  const [selectedChapter, setSelectedChapter] = useState(0)
  const [isLoadingStudy, setIsLoadingStudy] = useState(false)
  const studyRequest = useRef<AbortController | null>(null)

  useEffect(() => () => studyRequest.current?.abort(), [])

  // A chapter goes through the same import as a pasted PGN, named after the
  // chapter unless the user gave a name.
  const submitChapter = (chapter: LichessStudyChapter) => {
    if (!chapter.isStandard) {
      toast.error(
        `This chapter is ${chapter.variant}; Maia analyzes standard chess only.`,
      )
      return
    }
    if (!isValidPgn(chapter.pgn)) {
      toast.error("Couldn't read this chapter's moves.")
      return
    }
    onSubmit(
      'pgn',
      chapter.pgn,
      name.trim() || lichessStudyChapterTitle(chapter),
    )
  }

  /**
   * Loads the study a link points to. A chapter's link imports that chapter;
   * a whole study's lists its chapters to pick from (or imports its only one).
   */
  const loadStudy = async (url: string) => {
    const ref = parseLichessStudyUrl(url)
    if (!ref) {
      toast.error(
        'Paste a Lichess study link, like lichess.org/study/abcd1234 or one of its chapters.',
      )
      return
    }

    studyRequest.current?.abort()
    const controller = new AbortController()
    studyRequest.current = controller
    setIsLoadingStudy(true)
    try {
      const text = await fetchLichessStudyPgn(ref, controller.signal)
      const chapters = parseLichessStudyChapters(text)
      if (chapters.length === 0) {
        toast.error('This study has no chapters to import.')
        return
      }
      if (chapters.length === 1) {
        submitChapter(chapters[0])
        return
      }
      setStudy({ url, chapters })
      const firstStandard = chapters.findIndex((chapter) => chapter.isStandard)
      setSelectedChapter(Math.max(0, firstStandard))
    } catch (error) {
      if (controller.signal.aborted) return
      toast.error((error as Error).message)
    } finally {
      if (studyRequest.current === controller) {
        studyRequest.current = null
        setIsLoadingStudy(false)
      }
    }
  }

  const validateAndSubmit = () => {
    if (mode === 'study') {
      const url = studyUrl.trim()
      if (study && study.url === url) {
        submitChapter(study.chapters[selectedChapter])
      } else {
        loadStudy(url)
      }
      return
    }

    const trimmedInput = input.trim()

    if (!trimmedInput) {
      toast.error('Please enter some data')
      return
    }

    // A study link pasted as PGN is taken as one.
    if (mode === 'pgn' && parseLichessStudyUrl(trimmedInput)) {
      setMode('study')
      setStudyUrl(trimmedInput)
      setInput('')
      loadStudy(trimmedInput)
      return
    }

    let submitted = trimmedInput
    if (mode === 'fen') {
      // Analysis can look at a finished position, not an impossible one: the
      // engines break on a board with no king, say.
      const check = checkStartPosition(trimmedInput, { allowFinished: true })
      if (!check.ok) {
        toast.error(check.error)
        return
      }
      submitted = check.fen
    } else if (!isValidPgn(trimmedInput)) {
      toast.error(
        'Invalid PGN format: Unable to parse PGN. If using [Tag "..."] headers, include a blank line before the moves.',
      )
      return
    }

    onSubmit(mode, submitted, name.trim() || undefined)
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
          className="relative z-10 flex h-[550px] w-full max-w-[620px] flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-xl"
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
            <div className="relative border-b border-glass-border px-5 py-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-white/95">
                  Custom Analysis
                </h2>
                <p className="text-xs text-white/70">
                  Import a chess game from PGN notation or a Lichess study, or
                  analyze a specific position using FEN notation
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
                    <button
                      className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-all ${
                        mode === 'study'
                          ? 'border-transparent bg-glass-strong text-white hover:bg-glass-stronger'
                          : 'border-glass-border bg-glass text-white/80 hover:bg-glass-stronger'
                      }`}
                      onClick={() => setMode('study')}
                    >
                      Lichess Study
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
                    className="w-full rounded-md border border-glass-border bg-glass px-3 py-2 text-sm text-white/90 placeholder-white/40 focus:border-white/40 focus:outline-none"
                    placeholder="Enter a name for this analysis"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                {mode === 'study' ? (
                  <div>
                    <label
                      htmlFor="analysis-study-url"
                      className="mb-1 block text-sm font-medium text-white/80"
                    >
                      Study Link:
                    </label>
                    <input
                      id="analysis-study-url"
                      type="url"
                      className="w-full rounded-md border border-glass-border bg-glass px-3 py-2 font-mono text-sm text-white/90 placeholder-white/40 focus:border-white/40 focus:outline-none"
                      placeholder="https://lichess.org/study/abcd1234"
                      value={studyUrl}
                      onChange={(e) => setStudyUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') validateAndSubmit()
                      }}
                    />
                    <p className="mt-1 text-xs text-white/60">
                      Paste a link to a public or unlisted study, or to one of
                      its chapters. A study&apos;s chapters are listed to pick
                      from. Its variations are imported too.
                    </p>
                    {study && study.url === studyUrl.trim() ? (
                      <div
                        role="radiogroup"
                        aria-label="Chapter"
                        className="mt-3 flex max-h-48 flex-col overflow-y-auto rounded-md border border-glass-border"
                      >
                        {study.chapters.map((chapter, index) => (
                          <button
                            key={index}
                            role="radio"
                            aria-checked={selectedChapter === index}
                            disabled={!chapter.isStandard}
                            onClick={() => setSelectedChapter(index)}
                            onDoubleClick={() => submitChapter(chapter)}
                            className={`flex items-center justify-between gap-2 border-b border-glass-border px-3 py-1.5 text-left text-sm last:border-b-0 disabled:cursor-not-allowed disabled:opacity-40 ${
                              selectedChapter === index
                                ? 'bg-glass-strong text-white'
                                : 'text-white/80 hover:bg-glass-stronger'
                            }`}
                          >
                            <span className="truncate">
                              {index + 1}. {chapter.name}
                            </span>
                            {!chapter.isStandard ? (
                              <span className="shrink-0 text-xs text-white/60">
                                {chapter.variant}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="analysis-data"
                      className="mb-1 block text-sm font-medium text-white/80"
                    >
                      {mode === 'pgn' ? 'PGN Data:' : 'FEN Position:'}
                    </label>
                    <textarea
                      id="analysis-data"
                      className="h-32 w-full rounded-md border border-glass-border bg-glass px-3 py-2 font-mono text-sm text-white/90 placeholder-white/40 focus:border-white/40 focus:outline-none"
                      placeholder={mode === 'pgn' ? examplePGN : exampleFEN}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-white/60">
                      {mode === 'pgn'
                        ? 'Paste your PGN game notation here, or a Lichess study link. Headers and variations are supported (variations are saved in this browser).'
                        : 'Enter a valid FEN position string. This will set up the board for analysis.'}
                    </p>
                  </div>
                )}

                {mode !== 'study' && (
                  <div className="flex gap-2">
                    <button
                      className="rounded-md border border-glass-border bg-glass px-3 py-1.5 text-xs text-white/80 transition-colors hover:bg-glass-stronger"
                      onClick={() =>
                        setInput(mode === 'pgn' ? examplePGN : exampleFEN)
                      }
                    >
                      Use Example
                    </button>
                    <button
                      className="rounded-md border border-glass-border bg-glass px-3 py-1.5 text-xs text-white/80 transition-colors hover:bg-glass-stronger"
                      onClick={() => setInput('')}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 border-t border-glass-border px-5 py-4">
              <button
                className="flex-1 rounded-md border border-glass-border bg-glass px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-glass-stronger"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-md border border-glass-border bg-glass-strong px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-glass-stronger"
                onClick={validateAndSubmit}
                disabled={isLoadingStudy}
              >
                {mode !== 'study'
                  ? 'Analyze'
                  : isLoadingStudy
                    ? 'Loading…'
                    : (study && study.url === studyUrl.trim()) ||
                        parseLichessStudyUrl(studyUrl)?.chapterId
                      ? 'Analyze'
                      : 'Load Study'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  )
}
