import { useContext, useEffect, useState } from 'react'
import { WindowSizeContext } from 'src/contexts'
import {
  GameFeedback as Feedback,
  FeedbackStrength,
  sendGameFeedback,
} from 'src/api/play'
import {
  trackGameFeedbackGiven,
  trackGameFeedbackShown,
} from 'src/lib/analytics'

type Answers = Pick<Feedback, 'enjoyment' | 'humanlike' | 'strength'>
type Field = keyof Answers

const COMMENT_MAX = 2000

interface Choice {
  value: number | FeedbackStrength
  label: string
  /** For screen readers, where the label alone doesn't say it. */
  name: string
}

interface Question {
  field: Field
  question: string
  choices: Choice[]
  /** What the ends of a 1 to 5 scale mean, shown under it. */
  ends?: [string, string]
}

const scale = (low: string, high: string): Choice[] =>
  [1, 2, 3, 4, 5].map((value) => ({
    value,
    label: String(value),
    name: `${value} of 5${value === 1 ? `, ${low}` : value === 5 ? `, ${high}` : ''}`,
  }))

/** The bot's rating, from its name ("maia_kdd_1500"), if it has one. */
const botRating = (maiaVersion: string) => maiaVersion.match(/_(\d{3,4})$/)?.[1]

const questions = (maiaVersion: string): Question[] => {
  const rating = botRating(maiaVersion)
  return [
    {
      field: 'enjoyment',
      question: 'How much did you enjoy this game?',
      choices: scale('Not at all', 'A lot'),
      ends: ['Not at all', 'A lot'],
    },
    {
      field: 'humanlike',
      question: 'How human-like did Maia play?',
      choices: scale('Robotic', 'Human'),
      ends: ['Robotic', 'Human'],
    },
    {
      field: 'strength',
      question: rating
        ? `How strong did Maia play for a ${rating}?`
        : 'How strong did Maia play for its level?',
      choices: [
        { value: 'too_weak', label: 'Too weak', name: 'Too weak' },
        { value: 'about_right', label: 'About right', name: 'About right' },
        { value: 'too_strong', label: 'Too strong', name: 'Too strong' },
      ],
    },
  ]
}

interface Saved {
  answers: Answers
  comment: string
  done: boolean
}

// What the player has said about each game on this visit, kept outside the
// component: a change of layout (phone to wide screen, as the window is
// resized) draws the panel afresh, which would otherwise ask again about a
// game they had answered for.
const savedFeedback = new Map<string, Saved>()
const shownFor = new Set<string>()

interface Props {
  gameId: string
  maiaVersion: string
  challenge?: boolean
}

/**
 * After a game against Maia, in the panel with Analyze and Play again: three
 * quick questions and a comment, all optional. An answer is sent as soon as
 * it's picked (a player who taps one and leaves has still said something);
 * the comment when they send it. The server records which engine played,
 * which the player isn't told.
 *
 * Laid out to fit the side panel at its narrowest (about 120px inside, on a
 * laptop). On a phone, where it sits under the board and every line pushes
 * the page down, each question takes two lines: the question, then its
 * choices with what the ends of the scale mean beside them.
 */
export const GameFeedback: React.FC<Props> = ({
  gameId,
  maiaVersion,
  challenge = false,
}) => {
  const [answers, setAnswers] = useState<Answers>(
    () => savedFeedback.get(gameId)?.answers ?? {},
  )
  const [comment, setComment] = useState(
    () => savedFeedback.get(gameId)?.comment ?? '',
  )
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(
    () => savedFeedback.get(gameId)?.done ?? false,
  )
  const [failed, setFailed] = useState(false)
  const { isMobile: compact } = useContext(WindowSizeContext)

  useEffect(() => {
    savedFeedback.set(gameId, { answers, comment, done })
  }, [gameId, answers, comment, done])

  useEffect(() => {
    if (shownFor.has(gameId)) return
    shownFor.add(gameId)
    trackGameFeedbackShown({
      game_id: gameId,
      maia_version: maiaVersion,
      challenge,
    })
  }, [gameId, maiaVersion, challenge])

  const send = async (feedback: Feedback) => {
    setFailed(false)
    try {
      await sendGameFeedback(gameId, feedback)
      return true
    } catch (e) {
      console.error(e)
      setFailed(true)
      return false
    }
  }

  const answer = (field: Field, value: Choice['value']) => {
    if (answers[field] === value) return
    setAnswers((current) => ({ ...current, [field]: value }))
    trackGameFeedbackGiven({
      game_id: gameId,
      maia_version: maiaVersion,
      field,
      value,
    })
    send({ [field]: value })
  }

  const sendComment = async () => {
    const text = comment.trim()
    if (sending) return
    if (!text) {
      setDone(true)
      return
    }
    setSending(true)
    const ok = await send({ ...answers, comment: text })
    setSending(false)
    if (!ok) return
    trackGameFeedbackGiven({
      game_id: gameId,
      maia_version: maiaVersion,
      field: 'comment',
    })
    setDone(true)
  }

  const section = `mt-1 flex flex-col border-t border-glass-border ${
    compact ? 'pt-2' : 'pt-3'
  }`

  if (done) {
    return (
      <div
        role="status"
        className={`${section} items-center gap-1 text-center text-xs text-white/70`}
      >
        <span className="material-symbols-outlined !text-base text-human-3">
          favorite
        </span>
        Thanks for the feedback!
      </div>
    )
  }

  const answered = Object.values(answers).some((value) => value !== undefined)

  return (
    <section
      aria-label="Feedback on this game"
      className={`${section} ${compact ? 'gap-2' : 'gap-3'}`}
    >
      <p className="text-center text-xs font-semibold text-white/90">
        How was this game?
      </p>
      {questions(maiaVersion).map(({ field, question, choices, ends }) => (
        <div
          key={field}
          role="radiogroup"
          aria-label={question}
          className="flex flex-col gap-1"
        >
          <p className="text-[11px] leading-snug text-white/80">{question}</p>
          {ends ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {/* A fixed width, so both scales line up. */}
                {compact ? <End fixed>{ends[0]}</End> : null}
                <div className="flex flex-1 overflow-hidden rounded-md border border-glass-border bg-glass">
                  {choices.map(({ value, label, name }) => (
                    <ChoiceButton
                      key={value}
                      label={label}
                      name={name}
                      selected={answers[field] === value}
                      onClick={() => answer(field, value)}
                      className={`flex-1 ${compact ? 'py-1' : 'py-0.5'}`}
                    />
                  ))}
                </div>
                {compact ? (
                  <End fixed right>
                    {ends[1]}
                  </End>
                ) : null}
              </div>
              {compact ? null : (
                <div className="flex justify-between gap-2">
                  <End>{ends[0]}</End>
                  <End right>{ends[1]}</End>
                </div>
              )}
            </div>
          ) : (
            // Named choices: side by side where there's room, else one under
            // another (the side panel on a laptop).
            <div className="flex flex-wrap gap-1">
              {choices.map(({ value, label, name }) => (
                <ChoiceButton
                  key={value}
                  label={label}
                  name={name}
                  selected={answers[field] === value}
                  onClick={() => answer(field, value)}
                  className={`min-w-[4.5rem] flex-1 whitespace-nowrap rounded-md border border-glass-border ${
                    compact ? 'py-1' : 'py-0.5'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      ))}
      {answered ? (
        <div className={`flex gap-2 ${compact ? 'items-stretch' : 'flex-col'}`}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={COMMENT_MAX}
            rows={compact ? 1 : 2}
            placeholder="Anything else? (optional)"
            aria-label="Comments (optional)"
            className="min-w-0 flex-1 resize-none rounded-md border border-glass-border bg-glass px-2 py-1.5 text-xs text-white placeholder:text-white/40 focus:border-human-4/70 focus:outline-none"
          />
          <button
            type="button"
            onClick={sendComment}
            disabled={sending}
            className="shrink-0 rounded-md bg-human-4 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-human-4/80 disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Submit feedback'}
          </button>
        </div>
      ) : null}
      {failed ? (
        <p role="alert" className="text-center text-[11px] text-rose-300">
          Couldn&apos;t send that. Try again in a moment.
        </p>
      ) : null}
    </section>
  )
}

/** What an end of a 1 to 5 scale means. */
const End: React.FC<{
  children: React.ReactNode
  right?: boolean
  fixed?: boolean
}> = ({ children, right = false, fixed = false }) => (
  <span
    className={`shrink-0 text-[10px] leading-tight text-white/45 ${
      right ? 'text-right' : ''
    } ${fixed ? 'w-12' : ''}`}
  >
    {children}
  </span>
)

const ChoiceButton: React.FC<{
  label: string
  name: string
  selected: boolean
  onClick: () => void
  className: string
}> = ({ label, name, selected, onClick, className }) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    aria-label={name}
    onClick={onClick}
    className={`${className} text-xs font-medium transition-colors duration-200 ${
      selected
        ? 'bg-human-4 text-white hover:bg-human-4/90'
        : 'bg-glass text-white/70 hover:bg-glass-strong hover:text-white'
    }`}
  >
    {label}
  </button>
)
