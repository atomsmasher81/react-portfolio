import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Door } from "@/data/v2/theatre";

// Reads the Magic Theatre's rooms from private/theatre.json, falling back to
// the committed example so local development works out of the box. Read on
// every request, so editing the file on the server changes the rooms without
// a rebuild.

const DIR = path.join(process.cwd(), "private");

export interface TheatreContent {
    doors: Door[];
    mirror?: Door;
    /** What the mirror writes in its own breath, one at a time, when someone lingers in front of it. */
    words?: string[];
}

export async function loadTheatre(): Promise<TheatreContent> {
    for (const name of ["theatre.json", "theatre.example.json"]) {
        try {
            const data = JSON.parse(await readFile(path.join(DIR, name), "utf8")) as Partial<TheatreContent>;
            const doors = (data.doors ?? []).filter((d) => d && typeof d.id === "string" && typeof d.plate === "string" && d.room);
            const words = (data.words ?? []).filter((w): w is string => typeof w === "string" && w.trim().length > 0).map((w) => w.trim().slice(0, 40));
            return { doors, mirror: data.mirror && data.mirror.room ? data.mirror : undefined, words };
        } catch {
            // missing or malformed: try the next file
        }
    }
    return { doors: [] };
}

/** Private images, served from private/theatre-assets/. */
export const ASSET_DIR = path.join(DIR, "theatre-assets");
