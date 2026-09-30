import { notes } from "@/data/v2/notes";
import { ogCard, ogSize } from "@/lib/og";

export const size = ogSize;
export const contentType = "image/png";
export const alt = "A note by Kartik Gautam";

export function generateStaticParams() {
    return notes.map((n) => ({ slug: n.slug }));
}

export default function Image({ params }: { params: { slug: string } }) {
    const note = notes.find((n) => n.slug === params.slug);
    return ogCard({ eyebrow: "Notes", title: note?.title ?? "Notes", subtitle: note?.excerpt });
}
