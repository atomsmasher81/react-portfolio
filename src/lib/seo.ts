import type { Metadata } from "next";
import { profile } from "@/data/v2/profile";
import { experience } from "@/data/v2/work";

// Everything search engines and AI assistants read about the site, in one
// place: page metadata, and the structured data (JSON-LD) that says who wrote
// what. One canonical host, kartikgautam.com, everywhere.

export const SITE_URL = "https://kartikgautam.com";
export const SITE_NAME = "Kartik Gautam";
export const TAGLINE = "Senior full-stack engineer";
export const SITE_DESCRIPTION =
    "Senior full-stack engineer who builds, ships and scales products across fintech, hiring, healthcare, AI and e-signatures. Also: photos, notes and the night sky.";

export const absolute = (path: string) => (path === "/" ? SITE_URL : `${SITE_URL}${path}`);

// Content dates are plain days ("2024-11-08"); structured data wants a full
// timestamp with a zone, so pin them to midnight in India.
export const isoDate = (day: string) => (day.includes("T") ? day : `${day}T00:00:00+05:30`);

// Title, description, canonical, and Open Graph/Twitter tags that match the
// page. Open Graph doesn't merge with the root layout's, so each page carries
// its own full set; the share image comes from the nearest opengraph-image.
export function pageMeta({
    title,
    description,
    path,
    type = "website",
    publishedTime,
    modifiedTime,
}: {
    title?: string;
    description: string;
    path: string;
    type?: "website" | "article" | "profile";
    publishedTime?: string;
    modifiedTime?: string;
}): Metadata {
    const fullTitle = title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} · ${TAGLINE}`;
    return {
        ...(title ? { title } : {}),
        description,
        // Setting alternates replaces the layout's, so the feed link rides along here.
        alternates: { canonical: path, types: { "application/rss+xml": [{ url: "/feed.xml", title: "Kartik Gautam: blogs and notes" }] } },
        openGraph: {
            type,
            url: absolute(path),
            title: fullTitle,
            description,
            siteName: SITE_NAME,
            locale: "en_US",
            ...(type === "article"
                ? { publishedTime: publishedTime && isoDate(publishedTime), modifiedTime: modifiedTime && isoDate(modifiedTime), authors: [SITE_URL] }
                : {}),
        },
        twitter: { card: "summary_large_image", title: fullTitle, description, creator: "@kartik_gautam_" },
    };
}

const current = experience.find((r) => r.current);

// Who the site is about. Referenced by @id from every article, so authorship
// is one consistent entity across pages.
export const PERSON_ID = `${SITE_URL}/#person`;
export const person = {
    "@type": "Person",
    "@id": PERSON_ID,
    name: profile.name,
    url: SITE_URL,
    image: `${SITE_URL}/img/kartik-512.jpg`,
    email: `mailto:${profile.email}`,
    jobTitle: current?.positions[0].title ?? TAGLINE,
    description: SITE_DESCRIPTION,
    worksFor: current ? { "@type": "Organization", name: current.company, url: current.href } : undefined,
    alumniOf: { "@type": "CollegeOrUniversity", name: "AKTU" },
    nationality: { "@type": "Country", name: "India" },
    knowsAbout: [
        "Full-stack development",
        "Python",
        "Django",
        "Node.js",
        "React",
        "Next.js",
        "PostgreSQL",
        "System design",
        "Scaling backend systems",
        "Payment systems",
        "AI agents",
        "Healthcare revenue cycle management",
        "Engineering leadership",
    ],
    sameAs: profile.socials.map((s) => s.href),
};

export const WEBSITE_ID = `${SITE_URL}/#website`;
export const website = {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: "en",
    publisher: { "@id": PERSON_ID },
};

export function breadcrumbs(items: { name: string; path: string }[]) {
    return {
        "@type": "BreadcrumbList",
        itemListElement: [{ name: "Home", path: "/" }, ...items].map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item.name,
            item: absolute(item.path),
        })),
    };
}

export function article({
    type = "BlogPosting",
    path,
    headline,
    description,
    datePublished,
    dateModified,
    keywords,
    wordCount,
}: {
    type?: "BlogPosting" | "Article";
    path: string;
    headline: string;
    description: string;
    datePublished: string;
    dateModified?: string;
    keywords?: string[];
    wordCount?: number;
}) {
    return {
        "@type": type,
        "@id": `${absolute(path)}#article`,
        mainEntityOfPage: absolute(path),
        url: absolute(path),
        headline,
        description,
        image: `${absolute(path)}/opengraph-image`,
        datePublished: isoDate(datePublished),
        dateModified: isoDate(dateModified ?? datePublished),
        author: { "@id": PERSON_ID, name: profile.name, url: SITE_URL },
        publisher: { "@id": PERSON_ID },
        isPartOf: { "@id": WEBSITE_ID },
        inLanguage: "en",
        ...(keywords?.length ? { keywords: keywords.join(", ") } : {}),
        ...(wordCount ? { wordCount } : {}),
    };
}

// One <script> per page with every node in a @graph, so the entities can
// point at each other by @id.
export function graph(...nodes: object[]) {
    return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes });
}
