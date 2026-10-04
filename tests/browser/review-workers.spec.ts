import { test, expect } from '@playwright/test'

const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'

test('review worker settings persist and remain bounded in the browser', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await page.route(
    '**/api/v1/analysis/user/analyze_user_maia_game/**',
    (route) =>
      route.fulfill({
        json: {
          id: 'worker-test',
          white_player: { name: 'Tester', rating: 1500 },
          black_player: { name: 'Maia 1500', rating: 1500 },
          termination: { result: '*', winner: 'none' },
          maia_versions: [],
          maia_evals: {},
          move_maps: [[], []],
          game_states: [
            { fen: startFen, last_move: null, last_move_san: '' },
            {
              fen: afterE4,
              last_move: ['e2', 'e4'],
              last_move_san: 'e4',
            },
          ],
        },
      }),
  )
  await page.route('**/api/v1/analysis/get_engine_analysis/**', (route) =>
    route.fulfill({ status: 404 }),
  )
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'maia-completed-tours',
      JSON.stringify(['analysis', 'openingDrill']),
    )
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 4,
    })
    const NativeWorker = window.Worker
    ;(window as any).__maiaWorkerRequests = []
    ;(window as any).Worker = class extends NativeWorker {
      private readonly workerId: number
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        this.workerId = Math.random()
      }
      postMessage(message: any, transfer: Transferable[]): void
      postMessage(message: any, options?: StructuredSerializeOptions): void
      postMessage(
        message: any,
        options?: Transferable[] | StructuredSerializeOptions,
      ) {
        if (message.type === 'inference') {
          ;(window as any).__maiaWorkerRequests.push(this.workerId)
        }
        super.postMessage(message, options as Transferable[])
      }
    }
  })

  await page.goto('/analysis/worker-test/play')
  const downloadModal = page.getByTestId('download-modal')
  await expect(downloadModal).toBeVisible({ timeout: 30_000 })
  await downloadModal.getByRole('button', { name: /Download Maia-3/ }).click()
  await expect(downloadModal).toBeHidden({ timeout: 180_000 })
  await expect
    .poll(() =>
      page.evaluate(
        () => new Set((window as any).__maiaWorkerRequests as number[]).size,
      ),
    )
    .toBeGreaterThanOrEqual(2)
  const tour = page.getByRole('alertdialog')
  if (await tour.isVisible()) {
    await tour.getByRole('button', { name: 'close' }).click()
  }
  const advanced = page.getByRole('button', {
    name: 'Advanced performance settings',
  })
  await expect(advanced).toBeVisible()
  await advanced.click()
  await expect(page.getByText('Up to 3 on this device.')).toBeVisible()
  const toggle = page.getByRole('checkbox', { name: 'Parallel Maia analysis' })
  const slider = page.getByRole('slider', { name: /Analysis workers/ })
  await toggle.uncheck()
  await expect(slider).toBeDisabled()
  await toggle.check()
  await slider.fill('3')
  await expect(page.getByText('Analysis workers: 3')).toBeVisible()

  await page.reload()
  await page
    .getByRole('button', { name: 'Advanced performance settings' })
    .click()
  await expect(
    page.getByRole('slider', { name: /Analysis workers/ }),
  ).toHaveValue('3')

  await page.goto('/drills')
  await expect(
    page.getByRole('heading', { name: 'Drill with Maia' }),
  ).toBeVisible()
  const drillTour = page.getByRole('alertdialog')
  if (await drillTour.isVisible()) {
    await drillTour.getByRole('button', { name: 'close' }).click()
  }
  await page
    .getByRole('button', { name: 'Advanced performance settings' })
    .click()
  await expect(
    page.getByRole('slider', { name: /Analysis workers/ }),
  ).toHaveValue('3')
  const drillDepth = page.getByRole('combobox', {
    name: 'Stockfish drill review',
  })
  await drillDepth.selectOption('12')
  await page.reload()
  if (await drillTour.isVisible()) {
    await drillTour.getByRole('button', { name: 'close' }).click()
  }
  await page
    .getByRole('button', { name: 'Advanced performance settings' })
    .click()
  await expect(
    page.getByRole('combobox', { name: 'Stockfish drill review' }),
  ).toHaveValue('12')

  await page.getByRole('button', { name: 'Giuoco Piano' }).click()
  await page.getByRole('button', { name: 'Add Drill', exact: true }).click()
  await page.getByRole('button', { name: /Start Drilling/ }).click()
  await expect(
    page.getByRole('button', { name: 'Advanced performance settings' }),
  ).toBeVisible()
})
