import { notes } from "@/data/v2/notes";
import { ogCard, ogSize } from "@/lib/og";

export const size = ogSize;
export const contentType = "image/png";
export const alt = "A note by Kartik Gautam";

export function generateStaticParams() {
    return notes.map((n) => ({ slug: n.slug }));
}

export default async function Image(props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;
    const note = notes.find((n) => n.slug === params.slug);
    return ogCard({ eyebrow: "Notes", title: note?.title ?? "Notes", subtitle: note?.excerpt });
}
