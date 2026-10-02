import type { Metadata } from "next";
import { MagicTheatrePage } from "@/components/v2/magic-theatre-page";
import { pageMeta } from "@/lib/seo";

// Hidden on purpose: no sitemap entry, no search result, not indexed. Its own
// share card (opengraph-image.jpg, the marquee) for when someone passes the link on.
export const metadata: Metadata = {
    ...pageMeta({
        title: "Magic Theatre",
        description: "The Magic Theatre from Hesse's Steppenwolf: a corridor of doors, each opening onto a room, and a broken mirror at the end. For madmen only.",
        path: "/magic-theatre",
        ownImage: true,
    }),
    robots: { index: false, follow: false },
};

export default function Theatre() {
    return <MagicTheatrePage />;
}
