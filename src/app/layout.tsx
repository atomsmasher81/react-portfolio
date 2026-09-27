import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./v2.css";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { LensProvider } from "@/components/v2/lens";
import { Shell } from "@/components/v2/shell";
import { lensNav, type SearchItem } from "@/components/v2/nav";
import { blogs } from "@/data/blogs";
import { projects } from "@/data/projects";
import { notes } from "@/data/v2/notes";
import { profile } from "@/data/v2/profile";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const GA_MEASUREMENT_ID = "G-ZPHPHMKFVR";

const title = "Kartik Gautam · Senior full-stack engineer";
const description =
    "Senior full-stack engineer who builds, ships and scales products across fintech, hiring, healthcare, AI and e-signatures. Also: photos, notes and the night sky.";

export const metadata: Metadata = {
    title: { default: title, template: "%s · Kartik Gautam" },
    description,
    keywords: ["Kartik Gautam", "Full Stack Developer", "Software Engineer", "React", "Next.js", "Python", "Node.js", "Tech Lead", "RapidClaims"],
    authors: [{ name: "Kartik Gautam" }],
    creator: "Kartik Gautam",
    publisher: "Kartik Gautam",
    robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://kartikgautam.com",
        title,
        description,
        siteName: "Kartik Gautam",
        images: [{ url: "https://kartikgautam.com/img/kartik.png", width: 2700, height: 2700, alt: "Kartik Gautam" }],
    },
    twitter: {
        card: "summary_large_image",
        title,
        description,
        creator: "@kartik_gautam_",
        images: ["https://kartikgautam.com/img/kartik.png"],
    },
    icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
    metadataBase: new URL("https://kartikgautam.com"),
};

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
        <html lang="en">
            <body>
                <GoogleAnalytics GA_MEASUREMENT_ID={GA_MEASUREMENT_ID} />
                <LensProvider>
                    <Shell searchIndex={searchIndex} fontClassName={`${sans.variable} ${mono.variable}`}>
                        {children}
                    </Shell>
                </LensProvider>
            </body>
        </html>
    );
}
