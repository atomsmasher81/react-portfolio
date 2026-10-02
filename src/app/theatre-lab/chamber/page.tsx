import { notFound } from "next/navigation";
import { ChamberLab } from "@/app/theatre-lab/benches";

// Dev-only workbench for the room behind a door. Not built for production.

export const metadata = { robots: { index: false, follow: false } };

export default function Lab() {
    if (process.env.NODE_ENV === "production") notFound();
    return <ChamberLab />;
}
