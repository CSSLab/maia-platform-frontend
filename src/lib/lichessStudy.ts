import { readPgnHeaders, splitPgnGames } from './pgn'

/**
 * Importing a game from a Lichess study link. The study's PGN comes straight
 * from Lichess's API in the browser (it allows any origin), and a chapter's
 * PGN then goes through the same import as a pasted one. Public and unlisted
 * studies need no sign-in; a private one can't be read this way.
 */

export interface LichessStudyRef {
  studyId: string
  chapterId?: string
}

export interface LichessStudyChapter {
  name: string
  studyName?: string
  pgn: string
  /** False for a variant (Crazyhouse, say), which Maia doesn't analyse. */
  isStandard: boolean
  variant?: string
}

// Study and chapter ids are 8 letters and digits. The page's address may add
// a move ("#12") or a query; embedded studies have /embed/ before the id.
const STUDY_URL_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?lichess\.org\/study\/(?:embed\/)?([A-Za-z0-9]{8})(?:\/([A-Za-z0-9]{8}))?\/?(?:[?#].*)?$/i

/** The study (and chapter) a Lichess study link points to, or null. */
export const parseLichessStudyUrl = (input: string): LichessStudyRef | null => {
  const match = input.trim().match(STUDY_URL_REGEX)
  if (!match) return null
  return match[2]
    ? { studyId: match[1], chapterId: match[2] }
    : { studyId: match[1] }
}

/** The address of the PGN of a chapter, or of every chapter of a study. */
export const lichessStudyPgnUrl = ({ studyId, chapterId }: LichessStudyRef) =>
  chapterId
    ? `https://lichess.org/api/study/${studyId}/${chapterId}.pgn`
    : `https://lichess.org/api/study/${studyId}.pgn`

/** What to tell the user when Lichess answers with an error status. */
export const lichessStudyErrorMessage = (
  status: number,
  ref: LichessStudyRef,
): string => {
  // Lichess answers 401 (signed out) or 403 (signed in, not a member) for a
  // study only its members may see.
  if (status === 401 || status === 403) {
    return 'This study is private. Make it public or unlisted on Lichess to import it.'
  }
  if (status === 404) {
    return ref.chapterId
      ? 'Lichess has no study chapter at this link. Check that it is right and that the chapter has not been deleted.'
      : 'Lichess has no study at this link. Check that it is right and that the study has not been deleted.'
  }
  if (status === 429) {
    return 'Lichess is limiting requests right now. Try again in a minute.'
  }
  return `Couldn't load the study from Lichess (error ${status}).`
}

const STANDARD_VARIANTS = ['standard', 'from position']

/** The chapters in a study's PGN, in order. */
export const parseLichessStudyChapters = (
  text: string,
): LichessStudyChapter[] =>
  splitPgnGames(text).map((pgn, index) => {
    const headers = readPgnHeaders(pgn)
    const variant = headers.Variant
    return {
      name: headers.ChapterName || headers.Event || `Chapter ${index + 1}`,
      studyName: headers.StudyName,
      pgn,
      isStandard:
        !variant || STANDARD_VARIANTS.includes(variant.trim().toLowerCase()),
      variant,
    }
  })

/** The name a chapter's custom game gets when the user doesn't give one. */
export const lichessStudyChapterTitle = (chapter: LichessStudyChapter) =>
  chapter.studyName && chapter.studyName !== chapter.name
    ? `${chapter.studyName}: ${chapter.name}`
    : chapter.name
