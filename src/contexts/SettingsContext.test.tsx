import { act, render } from '@testing-library/react'
import { trackSettingChanged } from 'src/lib/analytics'
import { SettingsProvider, useSettings } from './SettingsContext'

jest.mock('src/lib/analytics', () => ({ trackSettingChanged: jest.fn() }))

it('reports a setting changed, not one set to what it was', () => {
  const ctx = { current: null as ReturnType<typeof useSettings> | null }
  const Probe = () => {
    ctx.current = useSettings()
    return null
  }
  render(
    <SettingsProvider>
      <Probe />
    </SettingsProvider>,
  )
  act(() => ctx.current!.updateSetting('chessboardTheme', 'blue'))
  act(() => ctx.current!.updateSetting('chessboardTheme', 'blue'))
  act(() => ctx.current!.updateSetting('soundEnabled', false))
  expect((trackSettingChanged as jest.Mock).mock.calls).toEqual([
    ['board_theme', 'blue'],
    ['sound', false],
  ])
})
