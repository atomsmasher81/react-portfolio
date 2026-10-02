'use client';

import { MagicTheatre } from "@/components/v2/magic-theatre";
import { useTheatreHost } from "@/components/v2/theatre-host";

// The theatre in 3D is drawn by the site's shell (see theatre-host.tsx), so it
// can be built before you arrive and carry on across the change of page. This
// page draws the hand-drawn 2D corridor when 3D isn't possible: no WebGL,
// `?mode=2d`, or the 3D failing.

export function MagicTheatrePage() {
    const { flat } = useTheatreHost();
    return flat ? <MagicTheatre /> : null;
}
