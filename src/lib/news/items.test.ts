import fs from 'fs'
import path from 'path'

import { NEWS_ITEMS } from './items'

describe('NEWS_ITEMS', () => {
  it('links only to blog posts that exist', () => {
    const postsDir = path.join(process.cwd(), 'src/lib/blog/posts')

    for (const item of NEWS_ITEMS) {
      const post = item.href?.match(/^\/blog\/(.+)$/)?.[1]
      if (post) {
        expect(fs.existsSync(path.join(postsDir, `${post}.md`))).toBe(true)
      }
    }
  })

  it('dates every headline as a day', () => {
    for (const item of NEWS_ITEMS) {
      expect(item.date).toMatch(/^\d{4}-\d\d-\d\d$/)
    }
  })
})
