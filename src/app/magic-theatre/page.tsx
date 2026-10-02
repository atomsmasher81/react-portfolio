import type { Metadata } from "next";
import { MagicTheatrePage } from "@/components/v2/magic-theatre-page";

// Hidden on purpose: no sitemap entry, no search result, not indexed.
export const metadata: Metadata = {
    title: "Magic Theatre",
    description: "Entrance not for everybody.",
    robots: { index: false, follow: false },
};

export default function Theatre() {
    return <MagicTheatrePage />;
}
