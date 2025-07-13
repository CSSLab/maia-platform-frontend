import React from 'react'

export const FeedbackButton: React.FC = () => {
  return (
    <button
      id="feedback-button"
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-human-4 transition-all duration-200 hover:scale-105 hover:bg-human-3"
    >
      <span className="material-symbols-outlined text-white">feedback</span>
    </button>
  )
}
