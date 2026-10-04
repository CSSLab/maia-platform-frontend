import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:3107',
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE,
    },
  },
  webServer: {
    command: 'npm run dev -- --port 3107',
    url: 'http://127.0.0.1:3107',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
