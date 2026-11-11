'use server'

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

import { Post } from 'src/types'

const postsDir = path.join(process.cwd(), 'src/lib/blog/posts')

export function getSortedPostsData() {
  const fileNames = fs.readdirSync(postsDir)
  const posts: Post[] = fileNames.map((filename) => {
    const id = filename.replace(/\.md$/, '')

    const fullPath = path.join(postsDir, filename)
    const fileContents = fs.readFileSync(fullPath, 'utf8')
    const meta = matter(fileContents).data as Omit<Post, 'id'>

    return {
      id,
      ...meta,
    }
  })

  // Newest first; posts of the same day in the order of their file names.
  return posts.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date < b.date ? 1 : -1
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

export function getPostData(id: string): Post | undefined {
  const fullPath = path.join(postsDir, `${id}.md`)
  if (!fs.existsSync(fullPath)) {
    return undefined
  }

  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)

  return {
    id,
    ...data,
    content,
  } as Post
}
