import { blogs } from "@/data/blogs";
import { ogCard, ogSize } from "@/lib/og";

export const size = ogSize;
export const contentType = "image/png";
export const alt = "Blog post by Kartik Gautam";

export function generateStaticParams() {
    return blogs.map((b) => ({ id: b.id }));
}

export default function Image({ params }: { params: { id: string } }) {
    const post = blogs.find((b) => b.id === params.id);
    const date = post && new Date(post.date).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return ogCard({ eyebrow: post ? `Blog · ${date} · ${post.readTime}` : "Blog", title: post?.title ?? "Blogs" });
}
