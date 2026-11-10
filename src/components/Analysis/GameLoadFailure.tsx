import Link from 'next/link'

interface Props {
  // No game behind the link, rather than the server failing.
  notFound: boolean
  onRetry: () => void
}

/** Shown on the analysis page in place of a game that couldn't be loaded. */
export const GameLoadFailure = ({ notFound, onRetry }: Props) => (
  <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 px-4 py-24 text-center">
    <h1 className="text-3xl font-bold md:text-4xl">
      {notFound ? 'Game not found' : "Couldn't load this game"}
    </h1>
    <p className="max-w-md text-secondary">
      {notFound
        ? "There's no game at this link. It may have been mistyped, or the game may have been deleted."
        : // The server also fails this way for some links to games that
          // don't exist (a 500 for a missing Maia game).
          'The link may be wrong, or the server may be having trouble. Try again in a moment.'}
    </p>
    <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
      {!notFound && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded bg-human-4 px-5 py-2 font-medium text-white transition duration-200 hover:bg-human-4/80"
        >
          Try again
        </button>
      )}
      <Link
        href="/analysis"
        className={
          notFound
            ? 'rounded bg-human-4 px-5 py-2 font-medium text-white transition duration-200 hover:bg-human-4/80'
            : 'rounded border border-glass-border bg-glass px-5 py-2 font-medium transition duration-200 hover:bg-glass-stronger'
        }
      >
        Analyze another game
      </Link>
    </div>
  </div>
)
