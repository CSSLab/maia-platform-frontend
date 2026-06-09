import dynamic from 'next/dynamic'
import React, { ReactNode, useState } from 'react'
import type { PlaySetupModalProps } from 'src/components/Common/PlaySetupModal'

const PlaySetupModal = dynamic(
  () =>
    import('src/components/Common/PlaySetupModal').then(
      (mod) => mod.PlaySetupModal,
    ),
  { ssr: false },
)

const fn = () => {
  throw new Error('poorly provided ModalContext')
}

interface IModalContext {
  playSetupModalProps?: PlaySetupModalProps
  setPlaySetupModalProps: (arg0?: PlaySetupModalProps) => void
}

export const ModalContext = React.createContext<IModalContext>({
  setPlaySetupModalProps: fn,
})

export const ModalContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}: {
  children: ReactNode
}) => {
  const [playSetupModalProps, setPlaySetupModalProps] = useState<
    PlaySetupModalProps | undefined
  >(undefined)

  return (
    <ModalContext.Provider
      value={{
        playSetupModalProps,
        setPlaySetupModalProps,
      }}
    >
      {playSetupModalProps && <PlaySetupModal {...playSetupModalProps} />}
      {children}
    </ModalContext.Provider>
  )
}
