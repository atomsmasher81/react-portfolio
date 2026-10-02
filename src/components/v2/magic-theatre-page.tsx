'use client';

import { Footprints } from "lucide-react";
import { MagicTheatre } from "@/components/v2/magic-theatre";
import { useTheatreHost } from "@/components/v2/theatre-host";
import { Neon } from "@/components/v2/theatre-sign";
import { fellSC } from "@/components/v2/theatre-fonts";
import { theatre } from "@/data/v2/theatre";
import { ActionBar } from "@/components/v2/theatre3d/theatre-nav-bar";
import { useReadiness } from "@/components/v2/theatre3d/readiness";

// The theatre in 3D is drawn by the site's shell (see theatre-host.tsx), so it
// can be built before you arrive and carry on across the change of page. This
// page draws the hand-drawn 2D corridor when 3D isn't possible: no WebGL,
// `?mode=2d`, or the 3D failing.
//
// Until the 3D theatre's code has arrived (a few seconds on a slow phone), the
// page holds its dark cover with the sign, and its start card, waiting, just
// where the theatre will have them: they're in the page's HTML, so they're
// there from the first paint. The theatre then takes both over (theatre.tsx,
// theatre-nav-bar.tsx) and lights the card up once it's ready.

const noop = () => {};

export function MagicTheatrePage() {
    const { flat } = useTheatreHost();
    const { mounted } = useReadiness();
    if (flat) return <MagicTheatre />;
    if (mounted) return null;
    return (
        <>
            <div aria-hidden className="pointer-events-none fixed inset-0 z-[5] grid place-items-center bg-[#050303]">
                <Neon text={theatre.sign.toUpperCase()} dead={10} className={`${fellSC.className} text-[20px] tracking-[0.4em] opacity-70`} />
            </div>
            <ActionBar compact align="end" contextKey="start" primary={{ label: "Walk in", icon: <Footprints strokeWidth={1.6} />, onClick: noop }} waiting />
            {/* without scripts there's nothing to wait for */}
            <noscript>
                <style>{"[data-theatre-bar]{display:none}"}</style>
            </noscript>
        </>
    );
}
