export interface Post {
  id: string
  title: string
  content: string
  date: string
  tags: string[]
  excerpt: string
  arxiv?: string
  github?: string
  journal?: string
  image: string
}
