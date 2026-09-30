import { SkyPage } from "@/components/v2/sky";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Look up", description: "Tonight's moon, and why Kartik Gautam looks up at the night sky, with a pulsar you can listen to.", path: "/sky" });

export default function Sky() {
    return <SkyPage />;
}
