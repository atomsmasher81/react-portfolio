import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./v2.css";
import Analytics from "@/components/Analytics";
import { LensProvider } from "@/components/v2/lens";
import { Shell } from "@/components/v2/shell";
import { lensNav, type SearchItem } from "@/components/v2/nav";
import { blogs } from "@/data/blogs";
import { projects } from "@/data/projects";
import { notes } from "@/data/v2/notes";
import { profile } from "@/data/v2/profile";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, TAGLINE, person, website } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: { default: `${SITE_NAME} · ${TAGLINE}`, template: `%s · ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    keywords: ["Kartik Gautam", "Full Stack Developer", "Software Engineer", "React", "Next.js", "Python", "Node.js", "Tech Lead", "RapidClaims"],
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    // Share cards come from app/opengraph-image.tsx (and the per-post ones).
    openGraph: { type: "website", locale: "en_US", url: SITE_URL, siteName: SITE_NAME, title: `${SITE_NAME} · ${TAGLINE}`, description: SITE_DESCRIPTION },
    twitter: { card: "summary_large_image", creator: "@kartik_gautam_", title: `${SITE_NAME} · ${TAGLINE}`, description: SITE_DESCRIPTION },
    alternates: { types: { "application/rss+xml": [{ url: "/feed.xml", title: "Kartik Gautam: blogs and notes" }] } },
    icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
    manifest: "/manifest.json",
};

// The server always draws the work side (or the page's own side). Only a visitor
// headed for the life side needs to wait for it; mirrors LensProvider (lens.tsx).
const HOLD_FOR_LENS = `try{var l=new URLSearchParams(location.search).get("lens");if(l==="life"||(!l&&localStorage.getItem("kg-lens")==="life"))document.documentElement.setAttribute("data-hold","")}catch(e){}`;

// Built on the server so the palette doesn't ship full blog bodies to the client.
const searchIndex: SearchItem[] = [
    ...[...lensNav.work, ...lensNav.life.slice(1)].map((n) => ({
        id: `page-${n.href}`,
        label: n.label,
        hint: n.blurb,
        group: "Pages" as const,
        href: n.href,
    })),
    { id: "act-work", label: "Switch to the work side", hint: "Projects & experience", group: "Actions", action: "lens-work" },
    { id: "act-life", label: "Switch to the life side", hint: "Photos, notes, journey", group: "Actions", action: "lens-life" },
    { id: "act-email", label: "Copy email", hint: profile.email, group: "Actions", action: "copy-email" },
    ...notes.map((n) => ({ id: `note-${n.slug}`, label: n.title, hint: n.tags.join(", "), group: "Notes" as const, href: `/notes/${n.slug}` })),
    ...blogs.map((b) => ({ id: `blog-${b.id}`, label: b.title, hint: b.date, group: "Blogs" as const, href: `/blogs/${b.id}` })),
    ...projects
        .filter((p) => p.link)
        .map((p, i) => ({ id: `proj-${i}`, label: p.title, hint: p.description, group: "Projects" as const, href: p.link, external: true })),
    ...profile.socials.map((s) => ({ id: `link-${s.label}`, label: s.label, group: "Links" as const, href: s.href, external: true })),
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>
                {/* Before first paint: if the visitor is coming back to the life side, hold the page until it's applied (v2.css). */}
                <script dangerouslySetInnerHTML={{ __html: HOLD_FOR_LENS }} />
                {/* Without JavaScript, show what would have animated in. */}
                <noscript>
                    <style dangerouslySetInnerHTML={{ __html: `.v2 [style*="opacity:0"]{opacity:1!important;transform:none!important;filter:none!important}` }} />
                </noscript>
                <JsonLd nodes={[website, person]} />
                <Analytics />
                <LensProvider>
                    <Shell searchIndex={searchIndex} fontClassName={`${sans.variable} ${mono.variable}`}>
                        {children}
                    </Shell>
                </LensProvider>
            </body>
        </html>
    );
}
