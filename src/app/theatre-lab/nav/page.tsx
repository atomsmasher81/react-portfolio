import { notFound } from "next/navigation";
import { TheatreNavBench } from "@/app/theatre-lab/benches";

// Dev-only workbench for the Magic Theatre's navigation (the rail, the action bar, the mirror's question). Not built for production.

export const metadata = { robots: { index: false, follow: false } };

export default function NavLab() {
    if (process.env.NODE_ENV === "production") notFound();
    return <TheatreNavBench />;
}
