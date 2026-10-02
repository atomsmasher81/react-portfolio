import { readFile } from "node:fs/promises";
import path from "node:path";
import { ASSET_DIR } from "@/lib/theatre-content";

// Private images for the theatre's rooms, from private/theatre-assets/.
// Only plain file names: no paths, so nothing outside that folder is reachable.

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".avif": "image/avif",
};

export async function GET(_: Request, props: { params: Promise<{ name: string }> }) {
    const params = await props.params;
    const name = params.name;
    const type = TYPES[path.extname(name).toLowerCase()];
    if (!/^[\w.-]+$/.test(name) || name.startsWith(".") || !type) return new Response("Not found", { status: 404 });
    try {
        const file = await readFile(path.join(ASSET_DIR, name));
        return new Response(new Uint8Array(file), {
            headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600", "X-Robots-Tag": "noindex, nofollow" },
        });
    } catch {
        return new Response("Not found", { status: 404 });
    }
}
