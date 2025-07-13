import { getPostHog } from 'src/lib/posthog'

type EventProperties = Record<string, unknown>

/**
 * Safe event tracking function with error handling
 */
const safeTrack = (eventName: string, properties?: EventProperties) => {
  try {
    const posthog = getPostHog()
    if (posthog) {
      posthog.capture(eventName, properties)
    }
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

export const trackDownloadModelInitiated = (page: string) => {
  safeTrack('download_model_initiated', {
    model_type: 'maia2',
    model_size_mb: 90,
    page,
  })
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

export const trackStockfishEngineLoading = (page: string) => {
  safeTrack('stockfish_engine_loading', { page })
}

export const trackStockfishEngineReady = (
  loadTimeSeconds: number,
  page: string,
) => {
  safeTrack('stockfish_engine_ready', {
    load_time_seconds: loadTimeSeconds,
    page,
  })
}

export const trackMaiaEngineLoading = (page: string) => {
  safeTrack('maia_engine_loading', { page })
}

export const trackMaiaEngineReady = (loadTimeSeconds: number, page: string) => {
  safeTrack('maia_engine_ready', { load_time_seconds: loadTimeSeconds, page })
}

// Opening Selection & Drill Events
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
  targetMoves: number,
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
  targetMoves: number,
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
) => {
  safeTrack('drill_configuration_completed', {
    total_openings_selected: totalOpeningsSelected,
    total_drill_count: totalDrillCount,
    unique_openings: uniqueOpenings,
    average_target_moves: averageTargetMoves,
    maia_versions_used: maiaVersionsUsed,
    color_distribution: colorDistribution,
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
  drillIndex: number,
  openingName: string,
  playerMovesMade: number,
  targetMoves: number,
  completionPercentage: number,
  timeTakenSeconds: number,
) => {
  safeTrack('drill_completed', {
    drill_index: drillIndex,
    opening_name: openingName,
    player_moves_made: playerMovesMade,
    target_moves: targetMoves,
    completion_percentage: completionPercentage,
    time_taken_seconds: timeTakenSeconds,
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
  gameSource: 'lichess' | 'custom_pgn' | 'custom_fen' | 'url_import',
  gameLengthMoves: number,
  hasExistingAnalysis: boolean,
) => {
  safeTrack('analysis_game_loaded', {
    game_source: gameSource,
    game_length_moves: gameLengthMoves,
    has_existing_analysis: hasExistingAnalysis,
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
  whiteGuess: 'human' | 'bot',
  blackGuess: 'human' | 'bot',
  timeSpentSeconds: number,
  confidenceLevel?: number,
) => {
  safeTrack('turing_submission_made', {
    game_id: gameId,
    white_guess: whiteGuess,
    black_guess: blackGuess,
    confidence_level: confidenceLevel,
    time_spent_seconds: timeSpentSeconds,
  })
}

// Play vs Maia Events
export const trackPlayGameStarted = (
  gameType: 'vs_maia' | 'hand_and_brain',
  maiaVersion: string,
  playerColor: 'white' | 'black',
  timeControl?: string,
) => {
  safeTrack('play_game_started', {
    game_type: gameType,
    maia_version: maiaVersion,
    player_color: playerColor,
    time_control: timeControl,
  })
}

export const trackPlayMoveMade = (
  gameId: string,
  moveNumber: number,
  moveUci: string,
  timeRemainingSeconds: number,
) => {
  safeTrack('play_move_made', {
    game_id: gameId,
    move_number: moveNumber,
    move_uci: moveUci,
    time_remaining_seconds: timeRemainingSeconds,
  })
}

export const trackPlayGameEnded = (
  gameId: string,
  result: 'win' | 'loss' | 'draw',
  terminationReason: string,
  totalMoves: number,
  gameDurationSeconds: number,
) => {
  safeTrack('play_game_ended', {
    game_id: gameId,
    result,
    termination_reason: terminationReason,
    total_moves: totalMoves,
    game_duration_seconds: gameDurationSeconds,
  })
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

export const trackLichessConnectionInitiated = (
  source: 'homepage' | 'auth_prompt',
) => {
  safeTrack('lichess_connection_initiated', { source })
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
