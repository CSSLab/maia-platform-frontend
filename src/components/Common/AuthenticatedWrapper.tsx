import { ReactNode, useContext } from 'react'

import { AuthContext } from 'src/contexts'

interface Props {
  children?: ReactNode | undefined
  // Shown until the visitor's account or guest session has loaded, on the
  // server too: a page's shell.
  fallback?: ReactNode
}

export const AuthenticatedWrapper: React.FC<Props> = ({
  children,
  fallback = null,
}: Props) => {
  const { user } = useContext(AuthContext)

  return <>{user ? children : fallback}</>
}
