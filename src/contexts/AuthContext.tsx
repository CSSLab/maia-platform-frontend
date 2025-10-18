import { User } from 'src/types'
import React, { ReactNode, useCallback, useEffect, useState } from 'react'
import { fetchAccount, connectLichessUrl, logoutAndFetchAccount } from 'src/api'

interface IAuthContext {
  user: User | null
  connectLichess: () => void
  logout: () => Promise<void>
}

export const AuthContext = React.createContext<IAuthContext>({
  user: null,
  connectLichess: () => {
    throw new Error('poorly provided AuthContext, missing connectLichess')
  },
  logout: () => {
    throw new Error('poorly provided AuthContext, missing logout')
  },
})

export const AuthContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}: {
  children: ReactNode
}) => {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    async function getAndSetAccount() {
      const response = await fetchAccount()
      setUser(response)
    }

    getAndSetAccount()
  }, [])

  const connectLichess = useCallback(() => {
    window.location.assign(
      connectLichessUrl +
        '?redirect_url=' +
        encodeURIComponent(window.location.toString()),
    )
  }, [])

  const logout = useCallback(async () => {
    const response = await logoutAndFetchAccount()
    setUser(response)
  }, [])

  return (
    <AuthContext.Provider value={{ user, logout, connectLichess }}>
      {children}
    </AuthContext.Provider>
  )
}
