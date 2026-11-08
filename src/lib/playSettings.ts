import { PlayType, TimeControl, TimeControlOptions } from 'src/types'
import {
  INCREMENT_SECONDS_STEPS,
  TIME_MINUTES_STEPS,
  normalizeTimeControl,
} from 'src/lib/timeControl'

export const MAIA_VERSIONS = [
  'maia_kdd_600',
  'maia_kdd_800',
  'maia_kdd_1000',
  'maia_kdd_1100',
  'maia_kdd_1200',
  'maia_kdd_1300',
  'maia_kdd_1400',
  'maia_kdd_1500',
  'maia_kdd_1600',
  'maia_kdd_1700',
  'maia_kdd_1800',
  'maia_kdd_1900',
  'maia_kdd_2000',
  'maia_kdd_2200',
  'maia_kdd_2400',
  'maia_kdd_2600',
]

/**
 * The play setup dialog's choices from the last game the visitor started in
 * this browser, which the dialog starts from next time (instead of the first
 * option each time). Kept apart for vs Maia and Hand & Brain, which are set
 * up differently (an H&B player may well want a stronger opponent, say).
 *
 * The custom starting FEN isn't kept: it's for one position, and a dialog
 * opening with last week's position filled in would start a game from it by
 * mistake.
 */
export interface SavedPlaySettings {
  maiaVersion: string
  timeControl: TimeControl
  // The sliders' minutes and increment, kept while Unlimited is chosen.
  timeMinutes: number
  incrementSeconds: number
  simulateMaiaTime: boolean
  // vs Maia only.
  practice: boolean
  // Hand & Brain only.
  maiaPartnerVersion: string
  isBrain: boolean
}

const storageKey = (playType: PlayType) => `maia-play-settings-${playType}`

const isTimeControl = (value: unknown): value is TimeControl =>
  typeof value === 'string' && normalizeTimeControl(value) === value

// Each stored field is checked on its own, so that one that's no longer
// valid (a Maia version since removed, a slider step changed) falls back to
// the default without losing the rest.
const VALIDATORS: {
  [K in keyof SavedPlaySettings]: (value: unknown) => boolean
} = {
  maiaVersion: (v) => MAIA_VERSIONS.includes(v as string),
  timeControl: isTimeControl,
  timeMinutes: (v) => TIME_MINUTES_STEPS.includes(v as number),
  incrementSeconds: (v) => INCREMENT_SECONDS_STEPS.includes(v as number),
  simulateMaiaTime: (v) => typeof v === 'boolean',
  practice: (v) => typeof v === 'boolean',
  maiaPartnerVersion: (v) => MAIA_VERSIONS.includes(v as string),
  isBrain: (v) => typeof v === 'boolean',
}

/** The valid fields of what `value` (parsed from storage) holds. */
export const validatePlaySettings = (
  value: unknown,
): Partial<SavedPlaySettings> => {
  if (!value || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  const valid: Partial<Record<keyof SavedPlaySettings, unknown>> = {}
  for (const key of Object.keys(VALIDATORS) as (keyof SavedPlaySettings)[]) {
    if (VALIDATORS[key](record[key])) valid[key] = record[key]
  }
  return valid as Partial<SavedPlaySettings>
}

export const loadPlaySettings = (
  playType: PlayType,
): Partial<SavedPlaySettings> => {
  try {
    const stored = window.localStorage.getItem(storageKey(playType))
    return stored ? validatePlaySettings(JSON.parse(stored)) : {}
  } catch {
    // Storage can be unavailable (private mode, blocked site data), or hold
    // something that isn't JSON.
    return {}
  }
}

export const savePlaySettings = (
  playType: PlayType,
  settings: Partial<SavedPlaySettings>,
) => {
  try {
    window.localStorage.setItem(
      storageKey(playType),
      JSON.stringify(validatePlaySettings(settings)),
    )
  } catch {
    // As above: the dialog then just starts from its defaults.
  }
}

/** The dialog's props that can set its initial choices. */
export interface PlaySetupInitialProps {
  playType: PlayType
  timeControl?: TimeControl
  maiaVersion?: string
  maiaPartnerVersion?: string
  isBrain?: boolean
  simulateMaiaTime?: boolean
  practice?: boolean
  startFen?: string
}

export interface PlaySetupInitialState {
  maiaVersion: string
  maiaPartnerVersion: string
  timeControl: TimeControl
  timeMinutes: number
  incrementSeconds: number
  isBrain: boolean
  simulateMaiaTime: boolean
  practice: boolean
  // The custom position's FEN (undefined: none; '' while being typed).
  fen: string | undefined
}

/**
 * The setup dialog's initial choices: its props first (Play again passes the
 * last game's settings; a challenge, the settings it requires), then what
 * was saved, then the defaults.
 */
export const playSetupInitialState = (
  props: PlaySetupInitialProps,
  saved: Partial<SavedPlaySettings>,
): PlaySetupInitialState => {
  // (A time control from the URL may be anything.)
  const timeControl = props.timeControl
    ? normalizeTimeControl(props.timeControl)
    : (saved.timeControl ?? TimeControlOptions[0])
  // The sliders follow the time control, except that Unlimited (the minutes
  // slider's last position) keeps the minutes and increment chosen before.
  const [minutes, increment] =
    timeControl === 'unlimited' ? [] : timeControl.split('+').map(Number)

  return {
    maiaVersion: props.maiaVersion || saved.maiaVersion || MAIA_VERSIONS[0],
    maiaPartnerVersion:
      props.maiaPartnerVersion || saved.maiaPartnerVersion || MAIA_VERSIONS[0],
    timeControl,
    timeMinutes:
      minutes ?? saved.timeMinutes ?? (TIME_MINUTES_STEPS.at(-1) as number),
    incrementSeconds: increment ?? saved.incrementSeconds ?? 0,
    isBrain: props.isBrain ?? saved.isBrain ?? false,
    simulateMaiaTime: props.simulateMaiaTime ?? saved.simulateMaiaTime ?? true,
    practice: props.practice ?? saved.practice ?? false,
    fen: props.startFen || undefined,
  }
}
