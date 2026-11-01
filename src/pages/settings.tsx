import Head from 'next/head'
import { NextPage } from 'next'
import { useContext, useEffect } from 'react'
import { useRouter } from 'next/router'

import { AuthContext } from 'src/contexts'
import { AuthenticatedWrapper } from 'src/components'
import { SettingsPage as SettingsPageComponent } from 'src/components/Settings'
import { MAIA_PROVIDERS } from 'src/contexts/pageProviders'

const SettingsPage: NextPage = () => {
  const router = useRouter()
  const { user } = useContext(AuthContext)

  useEffect(() => {
    // `user` is null until the account has loaded.
    if (user && !user.lichessId) {
      router.push('/')
    }
  }, [user, router])

  return (
    <>
      <Head>
        <title>Settings – Maia Chess</title>
        <meta
          name="description"
          content="Configure your Maia Chess experience"
        />
      </Head>
      <AuthenticatedWrapper>
        <SettingsPageComponent />
      </AuthenticatedWrapper>
    </>
  )
}

export default Object.assign(SettingsPage, { providers: MAIA_PROVIDERS })
