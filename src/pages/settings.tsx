import Head from 'next/head'
import { NextPage } from 'next'
import { useEffect, useState } from 'react'

import { SettingsPage as SettingsPageComponent } from 'src/components/Settings'
import { MAIA_PROVIDERS } from 'src/contexts/pageProviders'

// Open to everyone, signed in or not: every setting here (sound, board
// theme, the downloaded Maia model) is kept in this browser, not the
// account, and visitors who won't make an account need them too (a darker
// board, say).
const SettingsPage: NextPage = () => {
  // The settings are drawn once mounted, not in the server's HTML: that
  // can't know this browser's choices (SettingsContext reads them from
  // localStorage), and hydrating it would leave the default theme marked as
  // chosen. (The page used to wait for the account to load instead.)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <>
      <Head>
        <title>Settings – Maia Chess</title>
        <meta
          name="description"
          content="Configure your Maia Chess experience"
        />
      </Head>
      {mounted && <SettingsPageComponent />}
    </>
  )
}

export default Object.assign(SettingsPage, { providers: MAIA_PROVIDERS })
