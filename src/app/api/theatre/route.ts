import { NextResponse } from "next/server";
import { loadTheatre } from "@/lib/theatre-content";

// The outsides of the doors: ids and plaque inscriptions only (and the words
// the mirror writes in its breath). The rooms themselves come one at a time from
// /api/theatre/[id].

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET() {
    const { doors, mirror, words } = await loadTheatre();
    return NextResponse.json({ doors: doors.map(({ id, plate }) => ({ id, plate })), mirror: Boolean(mirror), words: words ?? [] }, { headers: HEADERS });
}
