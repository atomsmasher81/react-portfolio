import { notFound } from "next/navigation";
import { TheatreLab } from "@/app/theatre-lab/benches";

// Dev-only workbench for the 3D Magic Theatre's parts. Not built for production.

export const metadata = { robots: { index: false, follow: false } };

export default function Lab() {
    if (process.env.NODE_ENV === "production") notFound();
    return <TheatreLab />;
}
