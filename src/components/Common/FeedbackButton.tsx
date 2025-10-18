import React, { useContext } from 'react'
import { AuthContext } from 'src/contexts'

export const FeedbackButton: React.FC = () => {
  const { user } = useContext(AuthContext)

  if (!user?.lichessId) {
    return null
  }

  return (
    <button
      id="feedback-button"
      className="fixed bottom-8 right-8 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-glass-border bg-glass-strong backdrop-blur-md transition-all duration-200 hover:bg-glass-stronger"
    >
      <span className="material-symbols-outlined material-symbols-filled text-primary">
        feedback
      </span>
    </button>
  )
}
