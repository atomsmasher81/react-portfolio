import { MetadataRoute } from 'next'
import { blogs } from '@/data/blogs'
import { notes } from '@/data/v2/notes'
import { now } from '@/data/v2/now'
import { SITE_URL } from '@/lib/seo'

// Real content dates, not the build time: Google stops trusting lastmod when
// every page claims to change on every deploy.
const latest = (...dates: string[]) => new Date(dates.sort().at(-1)!)

export default function sitemap(): MetadataRoute.Sitemap {
  const blogDates = blogs.map((b) => b.date)
  const noteDates = notes.map((n) => n.date)
  const everything = latest(now.updated, ...blogDates, ...noteDates)

  const pages: [string, Date, number][] = [
    ['', everything, 1],
    ['/projects', everything, 0.9],
    ['/blogs', latest(...blogDates), 0.8],
    ['/notes', latest(...noteDates), 0.7],
    ['/now', new Date(now.updated), 0.7],
    ['/journey', everything, 0.7],
    ['/photos', everything, 0.6],
    ['/sky', everything, 0.5],
  ]

  return [
    ...pages.map(([route, lastModified, priority]) => ({ url: `${SITE_URL}${route}`, lastModified, priority })),
    ...blogs.map((b) => ({ url: `${SITE_URL}/blogs/${b.id}`, lastModified: new Date(b.date), priority: 0.6 })),
    ...notes.map((n) => ({ url: `${SITE_URL}/notes/${n.slug}`, lastModified: new Date(n.date), priority: 0.5 })),
  ]
}
