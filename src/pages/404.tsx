import Head from 'next/head'
import Link from 'next/link'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <Head>
        <title>Page Not Found – Maia Chess</title>
        <meta
          name="description"
          content="This page could not be found on Maia Chess."
        />
      </Head>
      <p className="text-sm font-semibold uppercase tracking-widest text-human-3">
        404
      </p>
      <h1 className="text-3xl font-bold md:text-4xl">Page not found</h1>
      <p className="max-w-md text-secondary">
        The page you were looking for doesn&apos;t exist or has moved.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded bg-human-4 px-5 py-2 font-medium text-white transition duration-200 hover:bg-human-4/80"
        >
          Go home
        </Link>
        <Link
          href="/analysis"
          className="rounded border border-glass-border bg-glass px-5 py-2 font-medium transition duration-200 hover:bg-glass-stronger"
        >
          Analyze a game
        </Link>
      </div>
    </div>
  )
}
