import { notFound } from "next/navigation";
import dynamic from "next/dynamic";

// Dev-only workbench for the 3D Magic Theatre's parts. Not built for production.
const TheatreLab = dynamic(() => import("@/components/v2/theatre3d/lab").then((m) => m.TheatreLab), { ssr: false });

export const metadata = { robots: { index: false, follow: false } };

export default function Lab() {
    if (process.env.NODE_ENV === "production") notFound();
    return <TheatreLab />;
}
