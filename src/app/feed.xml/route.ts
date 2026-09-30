import { blogs } from "@/data/blogs";
import { notes } from "@/data/v2/notes";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// RSS for blogs and notes: feed readers, and a clean list of everything
// written here for crawlers that follow feeds.
export function GET() {
    const items = [
        ...blogs.map((b) => ({ title: b.title, path: `/blogs/${b.id}`, date: b.date, summary: b.description })),
        ...notes.map((n) => ({ title: n.title, path: `/notes/${n.slug}`, date: n.date, summary: n.excerpt })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(SITE_NAME)}</title>
<link>${SITE_URL}</link>
<description>${esc(SITE_DESCRIPTION)}</description>
<language>en</language>
<atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
<lastBuildDate>${new Date(items[0].date).toUTCString()}</lastBuildDate>
${items
    .map(
        (i) => `<item>
<title>${esc(i.title)}</title>
<link>${SITE_URL}${i.path}</link>
<guid isPermaLink="true">${SITE_URL}${i.path}</guid>
<pubDate>${new Date(i.date).toUTCString()}</pubDate>
<author>hello@kartikgautam.com (Kartik Gautam)</author>
<description>${esc(i.summary)}</description>
</item>`,
    )
    .join("\n")}
</channel>
</rss>`;
    return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
