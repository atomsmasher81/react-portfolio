import { MetadataRoute } from 'next'
import { blogs } from '@/data/blogs'
import { notes } from '@/data/v2/notes'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://kartikgautam.com'

  const staticRoutes = ['', '/projects', '/blogs', '/photos', '/notes', '/journey', '/now', '/sky'].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  const blogRoutes = blogs.map((blog) => ({
    url: `${baseUrl}/blogs/${blog.id}`,
    lastModified: new Date(blog.date),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  const noteRoutes = notes.map((note) => ({
    url: `${baseUrl}/notes/${note.slug}`,
    lastModified: new Date(note.date),
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  return [...staticRoutes, ...blogRoutes, ...noteRoutes]
}
