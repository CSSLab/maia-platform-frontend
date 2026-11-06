import toast, { Toast } from 'react-hot-toast'

const TOAST_ID = 'maia-move-failed'

/**
 * Maia's move couldn't be fetched. Without it the game can't go on, so the
 * message stays until the player tries again or dismisses it.
 */
export const showMaiaMoveFailedToast = (retry: () => void) => {
  const content = (t: Toast) => (
    <span className="flex items-center gap-3">
      <span>Maia couldn&apos;t make its move.</span>
      <button
        type="button"
        className="shrink-0 rounded bg-human-4 px-3 py-1 text-sm text-white transition hover:bg-human-4/80"
        onClick={() => {
          toast.dismiss(t.id)
          retry()
        }}
      >
        Try again
      </button>
      <button
        type="button"
        className="shrink-0 py-1 text-sm opacity-60 transition hover:opacity-100"
        onClick={() => toast.dismiss(t.id)}
      >
        Dismiss
      </button>
    </span>
  )
  toast.error(content, {
    id: TOAST_ID,
    duration: Infinity,
    style: { maxWidth: 480 },
  })
}

export const dismissMaiaMoveFailedToast = () => toast.dismiss(TOAST_ID)
