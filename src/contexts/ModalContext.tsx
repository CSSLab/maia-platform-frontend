import { PlaySetupModal } from 'src/components'
import React, { ComponentProps, ReactNode, useState } from 'react'

const fn = () => {
  throw new Error('poorly provided ModalContext')
}

interface IModalContext {
  playSetupModalProps?: ComponentProps<typeof PlaySetupModal>
  setPlaySetupModalProps: (arg0?: ComponentProps<typeof PlaySetupModal>) => void
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
    ComponentProps<typeof PlaySetupModal> | undefined
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
