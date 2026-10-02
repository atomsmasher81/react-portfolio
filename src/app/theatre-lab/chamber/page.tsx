import { notFound } from "next/navigation";
import dynamic from "next/dynamic";

// Dev-only workbench for the room behind a door. Not built for production.
const ChamberLab = dynamic(() => import("@/components/v2/theatre3d/chamber-lab").then((m) => m.ChamberLab), { ssr: false });

export const metadata = { robots: { index: false, follow: false } };

export default function Lab() {
    if (process.env.NODE_ENV === "production") notFound();
    return <ChamberLab />;
}
