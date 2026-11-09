'use client'

import { capture, captureOnExit } from 'src/lib/posthogClient'
import { STOCKFISH_ENGINE } from 'src/constants/analysis'

type EventProperties = Record<string, unknown>

/**
 * Safe event tracking function with error handling
 */
const safeTrack = (eventName: string, properties?: EventProperties) => {
  try {
    capture(eventName, properties)
  } catch (error) {
    console.error(`Failed to track event ${eventName}:`, error)
  }
}

// Model Download & Engine Events
export const trackDownloadModelModalShown = (
  trigger: 'page_load' | 'manual_retry',
  page: string,
) => {
  safeTrack('download_model_modal_shown', { trigger, page })
}

export const trackDownloadModelInitiated = (
  page: string,
  trigger: 'wall' | 'auto' | 'tap' | 'panel',
) => {
  safeTrack('download_model_initiated', {
    model_type: 'maia2',
    model_size_mb: 90,
    page,
    trigger,
  })
}

/** The model has been saved, and whether the browser promises to keep it. */
export const trackMaiaModelProtected = (granted: boolean) => {
  safeTrack('maia_model_protected', { granted })
}

/** Downloaded, but the browser wouldn't save it: it's needed again next time. */
export const trackMaiaModelStoreFailed = (
  message: string,
  storage: { quota_mb?: number; usage_mb?: number },
) => {
  safeTrack('maia_model_store_failed', { message, ...storage })
}

/** Saved, but as plain bytes: the browser refused it as a Blob. */
export const trackMaiaModelStoredAsBytes = (blobError: string) => {
  safeTrack('maia_model_stored_as_bytes', { blob_error: blobError })
}

/** The browser no longer has a model it had saved. */
export const trackMaiaModelLost = (daysSinceSaved: number) => {
  safeTrack('maia_model_lost', { days_since_saved: daysSinceSaved })
}

/** "Continue without Maia" on the download prompt. */
export const trackDownloadModelDismissed = (page: string) => {
  safeTrack('download_model_dismissed', { page })
}

export const trackDownloadModelCompleted = (
  downloadTimeSeconds: number,
  page: string,
) => {
  safeTrack('download_model_completed', {
    model_type: 'maia2',
    download_time_seconds: downloadTimeSeconds,
    page,
  })
}

export const trackDownloadModelFailed = (
  errorType: string,
  retryCount: number,
  page: string,
) => {
  safeTrack('download_model_failed', {
    error_type: errorType,
    retry_count: retryCount,
    page,
  })
}

/** Maia's move in a game couldn't be fetched, even after retrying. */
export const trackMaiaMoveFailed = (message: string, status?: number) => {
  safeTrack('maia_move_failed', { message: message.slice(0, 300), status })
}

/**
 * A game couldn't be started (the visitor is then sent to /401). `status`:
 * the server's reply, if there was one.
 */
export const trackGameStartFailed = (
  gameType: 'play' | 'hand' | 'brain',
  error: unknown,
  status?: number,
) => {
  safeTrack('game_start_failed', {
    game_type: gameType,
    message: (error instanceof Error ? error.message : String(error)).slice(
      0,
      300,
    ),
    status,
    online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
    cookies_enabled:
      typeof navigator !== 'undefined' ? navigator.cookieEnabled : undefined,
  })
}

export const trackStockfishEngineLoading = (page: string) => {
  safeTrack('stockfish_engine_loading', { page })
}

export const trackStockfishEngineReady = (
  loadTimeSeconds: number,
  page: string,
  memoryRetries = 0,
) => {
  safeTrack('stockfish_engine_ready', {
    load_time_seconds: loadTimeSeconds,
    page,
    engine: STOCKFISH_ENGINE,
    memory_retries: memoryRetries,
  })
}

export const trackStockfishEngineFailed = (
  error: string,
  loadTimeSeconds: number,
  page: string,
  memoryRetries = 0,
) => {
  safeTrack('stockfish_engine_failed', {
    error: error.slice(0, 500),
    load_time_seconds: loadTimeSeconds,
    page,
    engine: STOCKFISH_ENGINE,
    memory_retries: memoryRetries,
  })
}

export const trackMaiaEngineLoading = (page: string) => {
  safeTrack('maia_engine_loading', { page })
}

export const trackMaiaEngineReady = (
  loadTimeSeconds: number,
  page: string,
  restarts = 0,
) => {
  safeTrack('maia_engine_ready', {
    load_time_seconds: loadTimeSeconds,
    page,
    restarts,
  })
}

export const trackMaiaEngineFailed = (
  error: string,
  loadTimeSeconds: number,
  page: string,
  restarts = 0,
) => {
  safeTrack('maia_engine_failed', {
    error: error.slice(0, 500),
    load_time_seconds: loadTimeSeconds,
    page,
    restarts,
  })
}

// The analysis page's timings: see src/lib/analysisTiming.ts
export const trackAnalysisEngineLoad = (properties: EventProperties) => {
  safeTrack('analysis_engine_load', properties)
}

export const trackAnalysisEngineSteps = (properties: EventProperties) => {
  safeTrack('analysis_engine_steps', properties)
}

export const trackAnalysisPageEndedUnexpectedly = (
  properties: EventProperties,
) => {
  safeTrack('analysis_page_ended_unexpectedly', properties)
}

export const trackOpeningSelectionModalOpened = (
  source: 'page_load' | 'change_selections_button',
  existingSelectionsCount: number,
) => {
  safeTrack('opening_selection_modal_opened', {
    source,
    existing_selections_count: existingSelectionsCount,
  })
}

export const trackOpeningSearchUsed = (
  searchTerm: string,
  resultsCount: number,
) => {
  safeTrack('opening_search_used', {
    search_term: searchTerm,
    results_count: resultsCount,
  })
}

export const trackOpeningPreviewSelected = (
  openingName: string,
  openingId: string,
  hasVariation: boolean,
  variationName?: string,
) => {
  safeTrack('opening_preview_selected', {
    opening_name: openingName,
    opening_id: openingId,
    has_variation: hasVariation,
    variation_name: variationName,
  })
}

export const trackOpeningQuickAddUsed = (
  openingName: string,
  playerColor: 'white' | 'black',
  maiaVersion: string,
  targetMoves: number | null,
) => {
  safeTrack('opening_quick_add_used', {
    opening_name: openingName,
    player_color: playerColor,
    maia_version: maiaVersion,
    target_moves: targetMoves,
  })
}

export const trackOpeningConfiguredAndAdded = (
  openingName: string,
  playerColor: 'white' | 'black',
  maiaVersion: string,
  targetMoves: number | null,
  variationName?: string,
) => {
  safeTrack('opening_configured_and_added', {
    opening_name: openingName,
    variation_name: variationName,
    player_color: playerColor,
    maia_version: maiaVersion,
    target_moves: targetMoves,
  })
}

export const trackOpeningRemovedFromSelection = (
  openingName: string,
  selectionId: string,
) => {
  safeTrack('opening_removed_from_selection', {
    opening_name: openingName,
    selection_id: selectionId,
  })
}

export const trackDrillConfigurationCompleted = (
  totalOpeningsSelected: number,
  totalDrillCount: number,
  uniqueOpenings: number,
  averageTargetMoves: number,
  maiaVersionsUsed: string[],
  colorDistribution: { white: number; black: number },
  /** Set only for a drill a link started (the dialog's drills have none). */
  source?: 'linked_game',
) => {
  safeTrack('drill_configuration_completed', {
    total_openings_selected: totalOpeningsSelected,
    total_drill_count: totalDrillCount,
    unique_openings: uniqueOpenings,
    average_target_moves: averageTargetMoves,
    maia_versions_used: maiaVersionsUsed,
    color_distribution: colorDistribution,
    ...(source ? { source } : {}),
  })
}

export const trackDrillSessionStarted = (
  totalDrills: number,
  openingTypes: string[],
) => {
  safeTrack('drill_session_started', {
    total_drills: totalDrills,
    opening_types: openingTypes,
  })
}

export const trackDrillMoveMade = (
  drillIndex: number,
  moveNumber: number,
  moveUci: string,
  isPlayerMove: boolean,
  targetMoves: number,
) => {
  safeTrack('drill_move_made', {
    drill_index: drillIndex,
    move_number: moveNumber,
    move_uci: moveUci,
    is_player_move: isPlayerMove,
    target_moves: targetMoves,
  })
}

export const trackDrillCompleted = (
  openingName: string,
  maiaVersion: string,
  playerColor: 'white' | 'black',
  playerMovesMade: number,
  targetMoves: number | null,
  endReason: string | null,
  accuracy: number,
) => {
  safeTrack('drill_completed', {
    opening_name: openingName,
    maia_version: maiaVersion,
    player_color: playerColor,
    player_moves_made: playerMovesMade,
    target_moves: targetMoves,
    end_reason: endReason,
    accuracy,
  })
}

export const trackDrillSessionCompleted = (
  totalDrills: number,
  averagePerformance: number,
  totalTimeSeconds: number,
) => {
  safeTrack('drill_session_completed', {
    total_drills: totalDrills,
    average_performance: averagePerformance,
    total_time_seconds: totalTimeSeconds,
  })
}

// Analysis Page Events
export const trackAnalysisGameLoaded = (
  gameSource: 'tournament' | 'lichess' | 'play' | 'hand' | 'brain' | 'custom',
) => {
  safeTrack('analysis_game_loaded', {
    game_source: gameSource,
  })
}

export const trackCustomGameInputUsed = (
  inputType: 'pgn' | 'fen',
  inputLength: number,
  isValid: boolean,
) => {
  safeTrack('custom_game_input_used', {
    input_type: inputType,
    input_length: inputLength,
    is_valid: isValid,
  })
}

export const trackAnalysisComponentInteracted = (
  component: 'highlight' | 'move_map' | 'blunder_meter' | 'moves_by_rating',
  action: 'click' | 'hover' | 'selection_change',
  moveUci?: string,
  ratingLevel?: string,
) => {
  safeTrack('analysis_component_interacted', {
    component,
    action,
    move_uci: moveUci,
    rating_level: ratingLevel,
  })
}

export const trackMaiaModelChanged = (
  previousModel: string,
  newModel: string,
  page: 'analysis' | 'puzzles' | 'openings',
) => {
  safeTrack('maia_model_changed', {
    previous_model: previousModel,
    new_model: newModel,
    page,
  })
}

export const trackGameExported = (
  exportFormat: 'pgn' | 'fen',
  exportScope: 'full_game' | 'current_position',
) => {
  safeTrack('game_exported', {
    export_format: exportFormat,
    export_scope: exportScope,
  })
}

// Puzzle Training Events
export const trackPuzzleStarted = (puzzleId: string, userRating: number) => {
  safeTrack('puzzle_started', {
    puzzle_id: puzzleId,
    user_rating: userRating,
  })
}

export const trackPuzzleMoveAttempted = (
  puzzleId: string,
  moveUci: string,
  attemptNumber: number,
  isCorrect: boolean,
) => {
  safeTrack('puzzle_move_attempted', {
    puzzle_id: puzzleId,
    move_uci: moveUci,
    attempt_number: attemptNumber,
    is_correct: isCorrect,
  })
}

export const trackPuzzleCompleted = (
  puzzleId: string,
  result: 'correct' | 'forfeit',
  attemptsMade: number,
  timeTakenSeconds: number,
  puzzleRating: number,
  ratingChange: number,
) => {
  safeTrack('puzzle_completed', {
    puzzle_id: puzzleId,
    result,
    attempts_made: attemptsMade,
    time_taken_seconds: timeTakenSeconds,
    puzzle_rating: puzzleRating,
    rating_change: ratingChange,
  })
}

export const trackPuzzleAnalysisUnlocked = (
  puzzleId: string,
  analysisTimeSpentSeconds: number,
) => {
  safeTrack('puzzle_analysis_unlocked', {
    puzzle_id: puzzleId,
    analysis_time_spent_seconds: analysisTimeSpentSeconds,
  })
}

export const trackContinueAgainstMaiaClicked = (
  sourcePage: 'puzzles' | 'openings',
  positionFen: string,
) => {
  safeTrack('continue_against_maia_clicked', {
    source_page: sourcePage,
    position_fen: positionFen,
  })
}

// Bot-or-Not (Turing Test) Events
export const trackTuringGameStarted = (gameId: string, userRating: number) => {
  safeTrack('turing_game_started', {
    game_id: gameId,
    user_rating: userRating,
  })
}

export const trackTuringMoveNavigated = (
  moveNumber: number,
  navigationType: 'next' | 'previous' | 'jump',
) => {
  safeTrack('turing_move_navigated', {
    move_number: moveNumber,
    navigation_type: navigationType,
  })
}

export const trackTuringSubmissionMade = (
  gameId: string,
  guessedBot: 'white' | 'black',
  correct: boolean,
  newRating: number,
  hasComment: boolean,
) => {
  safeTrack('turing_submission_made', {
    game_id: gameId,
    guessed_bot: guessedBot,
    correct,
    new_rating: newRating,
    has_comment: hasComment,
  })
}

// Play vs Maia Events (vs Maia, and Hand & Brain)
/** The kind of game, as the site's paths name it (/analysis/<id>/<type>). */
export type PlayGameType = 'play' | 'hand' | 'brain'

/**
 * How the opponent was picked: kept as the setup dialog offered it (the last
 * one played, or its first), changed there, or unknown (a link or a
 * reloaded page).
 */
export type OpponentChoice = 'preselected' | 'changed' | 'unknown'

/**
 * Sent with every event of one game. The properties these events had before
 * keep their names and meanings (game_type, is_brain, maia_version), so
 * existing insights and queries read the new events as they did the old.
 */
export interface PlayGameProperties {
  game_id: string
  game_type: 'vs_maia' | 'hand_and_brain'
  /** Hand & Brain: the visitor is the Brain (false: the Hand). */
  is_brain: boolean
  /** The bot, e.g. maia_kdd_1100 (the same as maia_version). */
  maia_name: string
  /** The bot, e.g. maia_kdd_1100: this property's meaning before. */
  maia_version: string
  /** The Maia generation playing it, e.g. maia3. */
  maia_model: string
}

export const playGameProperties = (
  gameId: string,
  type: PlayGameType,
  maiaName: string,
  maiaModel: string,
): PlayGameProperties => ({
  game_id: gameId,
  game_type: type === 'play' ? 'vs_maia' : 'hand_and_brain',
  is_brain: type === 'brain',
  maia_name: maiaName,
  maia_version: maiaName,
  maia_model: maiaModel,
})

export const trackPlayGameStarted = (
  game: PlayGameProperties,
  details: {
    time_control: string
    player_color: 'white' | 'black'
    was_default_opponent: boolean
    opponent_choice: OpponentChoice
    custom_position: boolean
    practice: boolean
    /** Continued from where it was left in this browser. */
    resumed: boolean
    logged_in: boolean
    /** Hand & Brain: the visitor's Maia partner. */
    maia_partner_name?: string
  },
) => {
  safeTrack('play_game_started', { ...game, ...details })
}

/** The game's first move, by either side. */
export const trackPlayFirstMove = (
  game: PlayGameProperties,
  side: 'human' | 'maia',
  msSinceStart: number,
) => {
  safeTrack('play_first_move', {
    ...game,
    side,
    ms_since_start: msSinceStart,
  })
}

// Both sides have moved, as opposed to a game opened and left untouched.
export const trackPlayGameFirstMoves = (game: PlayGameProperties) => {
  safeTrack('play_game_first_moves', { ...game })
}

/**
 * From the visitor's move (or the start, when Maia moves first) to Maia's
 * reply on the board. `sample_rate`: the share of such moves sent (all of a
 * game's first three, then about one in ten), to weight by. With human-like
 * thinking time on, it includes Maia's pretend thinking.
 */
export const trackMaiaMoveLatency = (
  game: PlayGameProperties,
  ply: number,
  ms: number,
  sampleRate: number,
  simulatedThinkingTime: boolean,
) => {
  safeTrack('maia_move_latency', {
    ...game,
    ply,
    ms,
    sample_rate: sampleRate,
    simulated_thinking_time: simulatedThinkingTime,
  })
}

/** From the visitor's side: a win is the visitor's, a loss Maia's. */
export type PlayResult = 'win' | 'loss' | 'draw'

/**
 * `total_moves`: plies (each side's move counts). Named as the event's
 * properties were before.
 */
export const trackPlayGameEnded = (
  game: PlayGameProperties,
  result: PlayResult,
  terminationReason: string,
  totalMoves: number,
  durationMs: number,
) => {
  safeTrack('play_game_ended', {
    ...game,
    result,
    termination_reason: terminationReason,
    total_moves: totalMoves,
    game_duration_seconds: Math.round(durationMs / 1000),
  })
}

/**
 * Left before the end: another game started, the page was left within the
 * site (`unmount`), or the tab was closed or navigated away (`pagehide`, sent
 * as a beacon). `resumable`: an unlimited or practice game, which this
 * browser can continue later.
 */
export const trackPlayGameAbandoned = (
  game: PlayGameProperties,
  plyCount: number,
  msSinceStart: number,
  exit: 'new_game' | 'unmount' | 'pagehide',
  resumable: boolean,
) => {
  const properties = {
    ...game,
    ply_count: plyCount,
    ms_since_start: msSinceStart,
    exit,
    resumable,
  }
  try {
    if (exit === 'pagehide') captureOnExit('play_game_abandoned', properties)
    else capture('play_game_abandoned', properties)
  } catch (error) {
    console.error('Failed to track event play_game_abandoned:', error)
  }
}

// The panel shown when a game against Maia ends.
export type PostGameCta =
  | 'analyze'
  | 'practice'
  | 'drill_opening'
  | 'play_again'

export const trackPostGameCtaShown = (
  cta: PostGameCta,
  gameId: string,
  gameType: PlayGameType,
) => {
  const { game_type, is_brain } = playGameProperties(gameId, gameType, '', '')
  safeTrack('post_game_cta_shown', {
    cta,
    game_id: gameId,
    game_type,
    is_brain,
  })
}

export const trackPostGameCtaClicked = (
  cta: PostGameCta,
  gameId: string,
  gameType: PlayGameType,
) => {
  const { game_type, is_brain } = playGameProperties(gameId, gameType, '', '')
  safeTrack('post_game_cta_clicked', {
    cta,
    game_id: gameId,
    game_type,
    is_brain,
  })
}

/** Where a guest was asked to sign in with Lichess. */
export type SignInPromptLocation = 'post_game'

export const trackSigninPromptShown = (location: SignInPromptLocation) => {
  safeTrack('signin_prompt_shown', { location })
}

export const trackSigninPromptClicked = (location: SignInPromptLocation) => {
  safeTrack('signin_prompt_clicked', { location })
}

// The visitor's own cards (home page and profile) and practice
export type PersonalLocation = 'home' | 'profile'

/**
 * The last-game card settled, once per page: with its key moments
 * (`has_analysis`: analysed before, here or saved with the backend), or
 * without (not analysed yet, no game, Lichess unreachable). The home page
 * analyses nothing by itself.
 */
export const trackLastGameCardShown = (
  hasAnalysis: boolean,
  usedMaiaModel: boolean,
  location: PersonalLocation,
) => {
  safeTrack('last_game_card_shown', {
    has_analysis: hasAnalysis,
    used_maia_model: usedMaiaModel,
    location,
  })
}

/**
 * The card's button pressed: find the game's key moments (Stockfish, here),
 * or add what players at the visitor's level play there (Maia).
 */
export const trackLastGameAnalyzeClicked = (
  what: 'moments' | 'maia',
  location: PersonalLocation,
) => {
  safeTrack('last_game_analyze_clicked', { what, location })
}

export const trackLastGameMomentClicked = (
  momentIndex: number,
  location: PersonalLocation,
) => {
  safeTrack('last_game_moment_clicked', { moment_index: momentIndex, location })
}

/** A practice session opened with positions to answer. */
export const trackPracticeStarted = (positions: number, remaining: number) => {
  safeTrack('practice_started', { positions, remaining })
}

export const trackPracticePositionAnswered = (
  correct: boolean,
  attempt: number,
) => {
  safeTrack('practice_position_answered', { correct, attempt })
}

/** The day's last position answered. */
export const trackPracticeCompleted = (
  correctCount: number,
  streakDays: number,
) => {
  safeTrack('practice_completed', {
    correct_count: correctCount,
    streak_days: streakDays,
  })
}

export const trackProgressStripShown = (location: PersonalLocation) => {
  safeTrack('progress_strip_shown', { location })
}

export const trackSigninTeaserClicked = (location: PersonalLocation) => {
  safeTrack('signin_teaser_clicked', { location })
}

// Navigation & Feature Discovery Events
export const trackHomepageFeatureClicked = (
  feature:
    | 'play_maia'
    | 'analysis'
    | 'puzzles'
    | 'hand_brain'
    | 'openings'
    | 'bot_or_not',
  userAuthenticated: boolean,
) => {
  safeTrack('homepage_feature_clicked', {
    feature,
    user_authenticated: userAuthenticated,
  })
}

/** Where a "Sign in with Lichess" button was pressed. */
export type SignInSource =
  | 'homepage'
  | 'header'
  | 'header_menu'
  | 'error_page'
  | 'game_over'
  | 'analysis_lichess_tab'
  | 'auth_prompt'
  | 'last_game_teaser'

export const trackLichessConnectionInitiated = (source: SignInSource) => {
  safeTrack('lichess_connection_initiated', { source })
}

/**
 * Why a Lichess sign-in didn't complete, as far as this site can tell: the
 * visitor came back without being signed in, or was sent to /401 (an account
 * Lichess sign-in doesn't allow). A sign-in that fails on the backend (Lichess
 * access denied, an error exchanging the code) ends on the backend's error
 * page and never comes back, unless the backend sends the visitor back with
 * ?lichess_error=<reason>, which is used as the reason.
 */
export type LichessConnectionFailure =
  | 'returned_signed_out'
  | 'not_allowed'
  | (string & {})

/**
 * The visitor came back from Lichess's sign-in (to the page they started
 * from). `seconds`: since the button was pressed.
 */
export const trackLichessConnectionCompleted = (
  source: SignInSource,
  seconds: number,
) => {
  safeTrack('lichess_connection_completed', { source, seconds })
  // The event this replaced, still sent so its insights and queries go on.
  safeTrack('lichess_sign_in_completed', { source, seconds })
}

export const trackLichessConnectionFailed = (
  source: SignInSource,
  seconds: number,
  reason: LichessConnectionFailure,
) => {
  safeTrack('lichess_connection_failed', { source, seconds, reason })
  safeTrack('lichess_sign_in_not_completed', { source, seconds })
}

export const trackLoggedOut = () => {
  safeTrack('logged_out')
}

export const trackTourStarted = (
  tourId: string,
  page: string,
  isFirstTime: boolean,
) => {
  safeTrack('tour_started', {
    tour_id: tourId,
    page,
    is_first_time: isFirstTime,
  })
}

export const trackTourStepCompleted = (tourId: string, stepNumber: number) => {
  safeTrack('tour_step_completed', {
    tour_id: tourId,
    step_number: stepNumber,
  })
}

export const trackTourCompleted = (tourId: string, totalSteps: number) => {
  safeTrack('tour_completed', {
    tour_id: tourId,
    total_steps: totalSteps,
  })
}

export const trackHelpButtonClicked = (page: string) => {
  safeTrack('help_button_clicked', { page })
}

// Error Tracking
export const trackErrorEncountered = (
  errorType: string,
  page: string,
  userAction: string,
  errorMessage: string,
) => {
  safeTrack('error_encountered', {
    error_type: errorType,
    page,
    user_action: userAction,
    error_message: errorMessage,
  })
}
