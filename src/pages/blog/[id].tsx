import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { GetStaticPaths, GetStaticProps } from 'next'

import { Post } from 'src/types'
import { Markdown } from 'src/components'
import { getSortedPostsData, getPostData } from 'src/lib/blog/posts'

interface BlogPostProps {
  post: Post
}

const BlogPost = ({ post }: BlogPostProps) => {
  const router = useRouter()

  if (router.isFallback) {
    return <div>Loading...</div>
  }

  return (
    <>
      <Head>
        <title>{post.title} – Maia Chess</title>
        <meta name="description" content={post.excerpt} />

        {/* Open Graph */}
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt} />
        <meta property="og:type" content="article" />
        <meta
          property="og:url"
          content={`https://maiachess.com/blog/${post.id}`}
        />
        <meta
          property="og:image"
          content={`https://maiachess.com${post.image}`}
        />
        <meta property="og:site_name" content="Maia Chess" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.excerpt} />
        <meta
          name="twitter:image"
          content={`https://maiachess.com${post.image}`}
        />

        {/* Article specific */}
        <meta property="article:published_time" content={post.date} />
        <meta property="article:author" content="Maia Chess Team" />
        {post.tags.map((tag, index) => (
          <meta key={index} property="article:tag" content={tag} />
        ))}

        {/* Additional SEO */}
        <meta name="author" content="Maia Chess Team" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`https://maiachess.com/blog/${post.id}`} />
      </Head>
      <div className="relative flex h-full flex-col items-center justify-center gap-5 py-[10%] md:py-[2%]">
        <div className="flex max-w-[90%] flex-col items-center justify-center overflow-x-hidden md:max-w-[80ch]">
          <div className="mb-8 flex w-full flex-col gap-2">
            <Link href="/blog">
              <p className="hover:opacity-75">← Go back</p>
            </Link>
            <h1 className="text-2xl font-bold md:text-4xl">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              <p>
                {new Date(post.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              {post.github && (
                <a
                  href={post.github}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  GitHub
                </a>
              )}
              {post.arxiv && (
                <a
                  href={post.arxiv}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  arXiv
                </a>
              )}
              {post.journal && <p>{post.journal}</p>}
            </div>
            <div className="no-scrollbar mt-1 flex items-center gap-2 overflow-x-scroll">
              {post.tags.map((tag, index) => (
                <div
                  key={index}
                  className="flex items-center justify-center gap-2 rounded bg-glass-strong px-3 py-1 backdrop-blur-md"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-human-2" />
                  <p className="select-none whitespace-nowrap text-sm text-secondary">
                    {tag}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="prose prose-sm prose-invert w-full max-w-none leading-relaxed md:prose-lg lg:prose-xl prose-headings:mb-2 prose-a:text-human-2 hover:prose-a:underline prose-ul:list-inside prose-ul:list-disc prose-li:text-sm prose-img:mb-2 prose-hr:my-8 prose-hr:opacity-20 lg:max-w-[80ch]">
            <Markdown>{post.content}</Markdown>
          </div>
        </div>
      </div>
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = getSortedPostsData()
  const paths = posts.map((post) => ({
    params: { id: post.id },
  }))

  return { paths, fallback: true }
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const post = getPostData(params?.id as string)

  return {
    props: {
      post,
    },
  }
}

export default BlogPost
