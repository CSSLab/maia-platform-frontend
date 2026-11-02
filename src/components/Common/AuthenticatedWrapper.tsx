import { ReactNode, useContext } from 'react'

import { AuthContext } from 'src/contexts'

interface Props {
  children?: ReactNode | undefined
}

export const AuthenticatedWrapper: React.FC<Props> = ({ children }: Props) => {
  const { user } = useContext(AuthContext)

  return <>{user && children}</>
}
