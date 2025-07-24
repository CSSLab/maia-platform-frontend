import * as analytics from '../../src/lib/analytics'

// Mock posthog
jest.mock('posthog-js', () => ({
  capture: jest.fn(),
}))

describe('Analytics functions', () => {
  const { capture: mockCapture } = jest.requireMock('posthog-js')
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('Safe tracking', () => {
    it('should handle posthog errors gracefully', () => {
      mockCapture.mockImplementation(() => {
        throw new Error('PostHog error')
      })

      analytics.trackErrorEncountered(
        'TestError',
        '/',
        'test_action',
        'test message',
      )

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to track event error_encountered:',
        expect.any(Error),
      )
    })
  })

  describe('Model Download & Engine Events', () => {
    it('should track download model modal shown', () => {
      analytics.trackDownloadModelModalShown('page_load', '/analysis')

      expect(mockCapture).toHaveBeenCalledWith('download_model_modal_shown', {
        trigger: 'page_load',
        page: '/analysis',
      })
    })

    it('should track download model initiated', () => {
      analytics.trackDownloadModelInitiated('/analysis')

      expect(mockCapture).toHaveBeenCalledWith('download_model_initiated', {
        model_type: 'maia2',
        model_size_mb: 90,
        page: '/analysis',
      })
    })

    it('should track download model completed', () => {
      analytics.trackDownloadModelCompleted(5.5, '/analysis')

      expect(mockCapture).toHaveBeenCalledWith('download_model_completed', {
        model_type: 'maia2',
        download_time_seconds: 5.5,
        page: '/analysis',
      })
    })

    it('should track download model failed', () => {
      analytics.trackDownloadModelFailed('network_error', 2, '/analysis')

      expect(mockCapture).toHaveBeenCalledWith('download_model_failed', {
        error_type: 'network_error',
        retry_count: 2,
        page: '/analysis',
      })
    })

    it('should track stockfish engine loading', () => {
      analytics.trackStockfishEngineLoading('/play')

      expect(mockCapture).toHaveBeenCalledWith('stockfish_engine_loading', {
        page: '/play',
      })
    })

    it('should track stockfish engine ready', () => {
      analytics.trackStockfishEngineReady(2.3, '/play')

      expect(mockCapture).toHaveBeenCalledWith('stockfish_engine_ready', {
        load_time_seconds: 2.3,
        page: '/play',
      })
    })

    it('should track maia engine loading', () => {
      analytics.trackMaiaEngineLoading('/analysis')

      expect(mockCapture).toHaveBeenCalledWith('maia_engine_loading', {
        page: '/analysis',
      })
    })

    it('should track maia engine ready', () => {
      analytics.trackMaiaEngineReady(3.7, '/analysis')

      expect(mockCapture).toHaveBeenCalledWith('maia_engine_ready', {
        load_time_seconds: 3.7,
        page: '/analysis',
      })
    })
  })

  describe('Opening Selection & Drill Events', () => {
    it('should track opening selection modal opened', () => {
      analytics.trackOpeningSelectionModalOpened('page_load', 5)

      expect(mockCapture).toHaveBeenCalledWith(
        'opening_selection_modal_opened',
        {
          source: 'page_load',
          existing_selections_count: 5,
        },
      )
    })

    it('should track opening search used', () => {
      analytics.trackOpeningSearchUsed('sicilian', 12)

      expect(mockCapture).toHaveBeenCalledWith('opening_search_used', {
        search_term: 'sicilian',
        results_count: 12,
      })
    })

    it('should track opening preview selected', () => {
      analytics.trackOpeningPreviewSelected(
        'Sicilian Defense',
        'B20',
        true,
        'Dragon Variation',
      )

      expect(mockCapture).toHaveBeenCalledWith('opening_preview_selected', {
        opening_name: 'Sicilian Defense',
        opening_id: 'B20',
        has_variation: true,
        variation_name: 'Dragon Variation',
      })
    })

    it('should track opening quick add used', () => {
      analytics.trackOpeningQuickAddUsed(
        'Sicilian Defense',
        'black',
        'maia-1500',
        10,
      )

      expect(mockCapture).toHaveBeenCalledWith('opening_quick_add_used', {
        opening_name: 'Sicilian Defense',
        player_color: 'black',
        maia_version: 'maia-1500',
        target_moves: 10,
      })
    })

    it('should track drill session started', () => {
      analytics.trackDrillSessionStarted(15, [
        'Sicilian',
        'French',
        'Caro-Kann',
      ])

      expect(mockCapture).toHaveBeenCalledWith('drill_session_started', {
        total_drills: 15,
        opening_types: ['Sicilian', 'French', 'Caro-Kann'],
      })
    })

    it('should track drill move made', () => {
      analytics.trackDrillMoveMade(3, 5, 'e2e4', true, 12)

      expect(mockCapture).toHaveBeenCalledWith('drill_move_made', {
        drill_index: 3,
        move_number: 5,
        move_uci: 'e2e4',
        is_player_move: true,
        target_moves: 12,
      })
    })

    it('should track drill completed', () => {
      analytics.trackDrillCompleted(1, 'Sicilian Defense', 8, 10, 80, 45.6)

      expect(mockCapture).toHaveBeenCalledWith('drill_completed', {
        drill_index: 1,
        opening_name: 'Sicilian Defense',
        player_moves_made: 8,
        target_moves: 10,
        completion_percentage: 80,
        time_taken_seconds: 45.6,
      })
    })
  })

  describe('Analysis Page Events', () => {
    it('should track analysis game loaded', () => {
      analytics.trackAnalysisGameLoaded('lichess', 45, true)

      expect(mockCapture).toHaveBeenCalledWith('analysis_game_loaded', {
        game_source: 'lichess',
        game_length_moves: 45,
        has_existing_analysis: true,
      })
    })

    it('should track custom game input used', () => {
      analytics.trackCustomGameInputUsed('pgn', 1500, true)

      expect(mockCapture).toHaveBeenCalledWith('custom_game_input_used', {
        input_type: 'pgn',
        input_length: 1500,
        is_valid: true,
      })
    })

    it('should track analysis component interacted', () => {
      analytics.trackAnalysisComponentInteracted(
        'highlight',
        'click',
        'e2e4',
        'maia-1500',
      )

      expect(mockCapture).toHaveBeenCalledWith(
        'analysis_component_interacted',
        {
          component: 'highlight',
          action: 'click',
          move_uci: 'e2e4',
          rating_level: 'maia-1500',
        },
      )
    })

    it('should track maia model changed', () => {
      analytics.trackMaiaModelChanged('maia-1100', 'maia-1500', 'analysis')

      expect(mockCapture).toHaveBeenCalledWith('maia_model_changed', {
        previous_model: 'maia-1100',
        new_model: 'maia-1500',
        page: 'analysis',
      })
    })

    it('should track game exported', () => {
      analytics.trackGameExported('pgn', 'full_game')

      expect(mockCapture).toHaveBeenCalledWith('game_exported', {
        export_format: 'pgn',
        export_scope: 'full_game',
      })
    })
  })

  describe('Puzzle Training Events', () => {
    it('should track puzzle started', () => {
      analytics.trackPuzzleStarted('puzzle-123', 1500)

      expect(mockCapture).toHaveBeenCalledWith('puzzle_started', {
        puzzle_id: 'puzzle-123',
        user_rating: 1500,
      })
    })

    it('should track puzzle move attempted', () => {
      analytics.trackPuzzleMoveAttempted('puzzle-123', 'e2e4', 1, true)

      expect(mockCapture).toHaveBeenCalledWith('puzzle_move_attempted', {
        puzzle_id: 'puzzle-123',
        move_uci: 'e2e4',
        attempt_number: 1,
        is_correct: true,
      })
    })

    it('should track puzzle completed', () => {
      analytics.trackPuzzleCompleted('puzzle-123', 'correct', 2, 45.6, 1400, 15)

      expect(mockCapture).toHaveBeenCalledWith('puzzle_completed', {
        puzzle_id: 'puzzle-123',
        result: 'correct',
        attempts_made: 2,
        time_taken_seconds: 45.6,
        puzzle_rating: 1400,
        rating_change: 15,
      })
    })

    it('should track continue against maia clicked', () => {
      analytics.trackContinueAgainstMaiaClicked(
        'puzzles',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      )

      expect(mockCapture).toHaveBeenCalledWith(
        'continue_against_maia_clicked',
        {
          source_page: 'puzzles',
          position_fen:
            'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        },
      )
    })
  })

  describe('Bot-or-Not (Turing Test) Events', () => {
    it('should track turing game started', () => {
      analytics.trackTuringGameStarted('game-456', 1600)

      expect(mockCapture).toHaveBeenCalledWith('turing_game_started', {
        game_id: 'game-456',
        user_rating: 1600,
      })
    })

    it('should track turing move navigated', () => {
      analytics.trackTuringMoveNavigated(15, 'next')

      expect(mockCapture).toHaveBeenCalledWith('turing_move_navigated', {
        move_number: 15,
        navigation_type: 'next',
      })
    })

    it('should track turing submission made', () => {
      analytics.trackTuringSubmissionMade('game-456', 'human', 'bot', 180.5, 85)

      expect(mockCapture).toHaveBeenCalledWith('turing_submission_made', {
        game_id: 'game-456',
        white_guess: 'human',
        black_guess: 'bot',
        confidence_level: 85,
        time_spent_seconds: 180.5,
      })
    })
  })

  describe('Play vs Maia Events', () => {
    it('should track play game started', () => {
      analytics.trackPlayGameStarted('vs_maia', 'maia-1500', 'white', '10+0')

      expect(mockCapture).toHaveBeenCalledWith('play_game_started', {
        game_type: 'vs_maia',
        maia_version: 'maia-1500',
        player_color: 'white',
        time_control: '10+0',
      })
    })

    it('should track play move made', () => {
      analytics.trackPlayMoveMade('game-789', 12, 'e2e4', 480)

      expect(mockCapture).toHaveBeenCalledWith('play_move_made', {
        game_id: 'game-789',
        move_number: 12,
        move_uci: 'e2e4',
        time_remaining_seconds: 480,
      })
    })

    it('should track play game ended', () => {
      analytics.trackPlayGameEnded('game-789', 'win', 'checkmate', 42, 1200)

      expect(mockCapture).toHaveBeenCalledWith('play_game_ended', {
        game_id: 'game-789',
        result: 'win',
        termination_reason: 'checkmate',
        total_moves: 42,
        game_duration_seconds: 1200,
      })
    })
  })

  describe('Navigation & Feature Discovery Events', () => {
    it('should track homepage feature clicked', () => {
      analytics.trackHomepageFeatureClicked('play_maia', true)

      expect(mockCapture).toHaveBeenCalledWith('homepage_feature_clicked', {
        feature: 'play_maia',
        user_authenticated: true,
      })
    })

    it('should track lichess connection initiated', () => {
      analytics.trackLichessConnectionInitiated('homepage')

      expect(mockCapture).toHaveBeenCalledWith('lichess_connection_initiated', {
        source: 'homepage',
      })
    })

    it('should track tour started', () => {
      analytics.trackTourStarted('analysis-tour', '/analysis', true)

      expect(mockCapture).toHaveBeenCalledWith('tour_started', {
        tour_id: 'analysis-tour',
        page: '/analysis',
        is_first_time: true,
      })
    })

    it('should track tour step completed', () => {
      analytics.trackTourStepCompleted('analysis-tour', 3)

      expect(mockCapture).toHaveBeenCalledWith('tour_step_completed', {
        tour_id: 'analysis-tour',
        step_number: 3,
      })
    })

    it('should track help button clicked', () => {
      analytics.trackHelpButtonClicked('/puzzles')

      expect(mockCapture).toHaveBeenCalledWith('help_button_clicked', {
        page: '/puzzles',
      })
    })
  })

  describe('Error Tracking', () => {
    it('should track error encountered', () => {
      analytics.trackErrorEncountered(
        'NetworkError',
        '/analysis',
        'load_game',
        'Failed to fetch game data',
      )

      expect(mockCapture).toHaveBeenCalledWith('error_encountered', {
        error_type: 'NetworkError',
        page: '/analysis',
        user_action: 'load_game',
        error_message: 'Failed to fetch game data',
      })
    })
  })

  describe('Edge cases and optional parameters', () => {
    it('should handle missing optional parameters', () => {
      analytics.trackOpeningPreviewSelected('Sicilian Defense', 'B20', false)

      expect(mockCapture).toHaveBeenCalledWith('opening_preview_selected', {
        opening_name: 'Sicilian Defense',
        opening_id: 'B20',
        has_variation: false,
        variation_name: undefined,
      })
    })

    it('should handle optional time control parameter', () => {
      analytics.trackPlayGameStarted('hand_and_brain', 'maia-1500', 'black')

      expect(mockCapture).toHaveBeenCalledWith('play_game_started', {
        game_type: 'hand_and_brain',
        maia_version: 'maia-1500',
        player_color: 'black',
        time_control: undefined,
      })
    })

    it('should handle analysis component interaction without optional params', () => {
      analytics.trackAnalysisComponentInteracted('blunder_meter', 'hover')

      expect(mockCapture).toHaveBeenCalledWith(
        'analysis_component_interacted',
        {
          component: 'blunder_meter',
          action: 'hover',
          move_uci: undefined,
          rating_level: undefined,
        },
      )
    })
  })
})
