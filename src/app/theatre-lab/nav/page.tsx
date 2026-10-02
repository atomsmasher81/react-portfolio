import { notFound } from "next/navigation";
import dynamic from "next/dynamic";

// Dev-only workbench for the Magic Theatre's navigation (the rail, the action bar, the mirror's question). Not built for production.
const TheatreNavBench = dynamic(() => import("@/components/v2/theatre3d/theatre-nav-bench").then((m) => m.TheatreNavBench), { ssr: false });

export const metadata = { robots: { index: false, follow: false } };

export default function NavLab() {
    if (process.env.NODE_ENV === "production") notFound();
    return <TheatreNavBench />;
}
