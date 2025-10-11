import Head from 'next/head'
import { NextPage } from 'next'
import { useContext, useEffect } from 'react'
import { useRouter } from 'next/router'

import { AuthContext } from 'src/contexts'
import { AuthenticatedWrapper } from 'src/components'
import { SettingsPage as SettingsPageComponent } from 'src/components/Settings'

const SettingsPage: NextPage = () => {
  const router = useRouter()
  const { user } = useContext(AuthContext)

  useEffect(() => {
    if (!user?.lichessId) {
      router.push('/')
    }
  }, [user, router])

  return (
    <AuthenticatedWrapper>
      <Head>
        <title>Settings – Maia Chess</title>
        <meta
          name="description"
          content="Configure your Maia Chess experience"
        />
      </Head>
      <SettingsPageComponent />
    </AuthenticatedWrapper>
  )
}

export default SettingsPage
