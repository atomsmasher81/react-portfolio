import { graph } from "@/lib/seo";

// Structured data for search engines and AI assistants. Server-rendered, so
// crawlers get it without running any JavaScript.
export function JsonLd({ nodes }: { nodes: object[] }) {
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: graph(...nodes) }} />;
}
