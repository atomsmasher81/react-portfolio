import { NextResponse } from "next/server";
import { loadTheatre } from "@/lib/theatre-content";

// One room, sent only when its door is opened.

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const { doors, mirror } = await loadTheatre();
    const door = params.id === "mirror" ? mirror : doors.find((d) => d.id === params.id);
    if (!door) return NextResponse.json({ error: "No such door." }, { status: 404, headers: HEADERS });
    return NextResponse.json(door, { headers: HEADERS });
}
