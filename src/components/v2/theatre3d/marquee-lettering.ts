import * as THREE from "three";
import { Built, canvasTextureWork, fbm, later, putWork, rng, valueNoise, type Work } from "@/components/v2/theatre3d/textures";
import { pixelTextureWork } from "@/components/v2/theatre3d/marquee-textures";

// The box office's writing, drawn on canvases in the theatre's own type:
// PRICE OF ADMISSION in gold leaf across the glass, the card behind it, YOUR
// MIND, in ink, and the playbill on its easel beside it. Canvases can only use a font once it has
// loaded, so each texture starts blank (the card starts as bare paper) and is
// drawn again when the font arrives. All of it is painted a slice at a time
// (textures.ts); prepareLettering() has it all done, lettering included.

const SC = { family: "MarqueeFellSC", url: "/fonts/IMFellEnglishSC.ttf" };
const ITALIC = { family: "MarqueeFellItalic", url: "/fonts/IMFellEnglish-Italic.ttf" };

const loading = new Map<string, Promise<boolean>>();
function loadFont({ family, url }: { family: string; url: string }) {
    let p = loading.get(family);
    if (!p) {
        p = new FontFace(family, `url(${url})`)
            .load()
            .then((face) => {
                document.fonts.add(face);
                return true;
            })
            .catch(() => false);
        loading.set(family, p);
    }
    return p;
}

/** Where the gold lettering sits on the window, in the window's space (x from its centre, y up from the sill). */
export const GOLD = { y0: 0.37, cap: 0.085 };

/**
 * Gold leaf on the glass, the way sign-writers did it: each letter laid in
 * leaf, outlined and given a dark drop shade so it reads against the dark
 * behind, and now flaking. PRICE OF follows the arch; ADMISSION bows gently
 * beneath it. Covers the window's full width and from GOLD.y0 to its top.
 */
interface Kept {
    built: Built<THREE.CanvasTexture>;
    /** settled once its lettering is on (or the font wouldn't come) */
    lettered: Promise<unknown> | null;
}
const made = new Map<string, Kept>();
/** One texture, kept: its ground painted first, then its lettering, once the font is in, a slice at a time. */
function keep(key: string, ground: () => Work<THREE.CanvasTexture>, letter: (tex: THREE.CanvasTexture) => Promise<unknown>) {
    let k = made.get(key);
    if (!k) {
        const entry: Kept = {
            built: new Built(function* () {
                const tex = (yield ground()) as THREE.CanvasTexture;
                entry.lettered = letter(tex);
                return tex;
            }),
            lettered: null,
        };
        made.set(key, (k = entry));
    }
    return k;
}
const lettering = (fonts: Promise<boolean[]>, work: () => Work<void>) => fonts.then((ok) => (ok.every(Boolean) ? later(work()) : undefined));

const goldKept = (win: { w: number; h: number }) => keep(`gold ${win.w} ${win.h}`, () => goldGround(win), (tex) => lettering(Promise.all([loadFont(SC)]), () => goldLetters(tex, win)));

export function goldLeaf(win: { w: number; h: number }) {
    return goldKept(win).built.get();
}

/** Paint all the booth's writing a slice at a time, lettering and all: then it's there at once. */
export async function prepareLettering(win: { w: number; h: number }, card: { w: number; h: number }) {
    for (const k of [goldKept(win), cardKept(card), playbillKept()]) {
        await k.built.prepare();
        await k.lettered;
    }
}

function* goldGround(win: { w: number; h: number }): Work<THREE.CanvasTexture> {
    const W = 1024;
    const H = Math.round((W * (win.h - GOLD.y0)) / win.w);
    return (yield canvasTextureWork(W, H, () => undefined)) as THREE.CanvasTexture;
}

function* goldLetters(tex: THREE.CanvasTexture, win: { w: number; h: number }): Work<void> {
    const W = 1024;
    const H = Math.round((W * (win.h - GOLD.y0)) / win.w);
    const px = W / win.w; // pixels per metre
    const canvas = tex.image as HTMLCanvasElement;
    // Window space to canvas pixels.
    const at = (x: number, y: number): [number, number] => [(x + win.w / 2) * px, (win.h - y) * px];
    {
        const ctx = canvas.getContext("2d")!;
        const size = GOLD.cap * px * 1.5; // IM Fell's capitals stand about two thirds of the body
        ctx.font = `${size}px ${SC.family}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";

        // Lay a string along a circle (centre cx, cy in window space; radius r to the baseline).
        const arc = (text: string, cx: number, cy: number, r: number, track: number) => {
            const widths = Array.from(text).map((ch) => ctx.measureText(ch).width + track * px);
            const total = widths.reduce((a, b) => a + b, 0);
            let s = -total / 2;
            return Array.from(text).map((ch, i) => {
                const mid = s + widths[i] / 2;
                s += widths[i];
                const a = mid / (r * px); // angle from straight up
                const [x, y] = at(cx + Math.sin(a) * r, cy + Math.cos(a) * r);
                return { ch, x, y, rot: a };
            });
        };
        const archCentre = win.h - win.w / 2;
        const letters = [...arc("PRICE OF", 0, archCentre, 0.32, 0.004), ...arc("ADMISSION", 0, 0.49 - 1.4, 1.4, 0.006)];

        const draw = (style: (ch: string) => void) => {
            for (const l of letters) {
                ctx.save();
                ctx.translate(l.x, l.y);
                ctx.rotate(l.rot);
                style(l.ch);
                ctx.restore();
            }
        };
        // The drop shade, then the outline, then the leaf.
        draw((ch) => {
            ctx.fillStyle = "rgba(12, 6, 3, 0.9)";
            ctx.fillText(ch, size * 0.045, size * 0.05);
        });
        draw((ch) => {
            ctx.strokeStyle = "#24140a";
            ctx.lineWidth = size * 0.07;
            ctx.lineJoin = "round";
            ctx.strokeText(ch, 0, 0);
        });
        draw((ch) => {
            const g = ctx.createLinearGradient(0, -size * 0.7, 0, 0);
            g.addColorStop(0, "#f6dc8c");
            g.addColorStop(0.45, "#c99a3a");
            g.addColorStop(0.55, "#a87824");
            g.addColorStop(1, "#e7c56c");
            ctx.fillStyle = g;
            ctx.fillText(ch, 0, 0);
        });
        yield;

        // Flaking: the leaf lost in patches and thin in others, then tarnished
        // in a broad wash. Both are masks laid over the letters, so the
        // canvas never has to be read back.
        const mw = W >> 1;
        const mh = H >> 1;
        const flakes = fbm(3301, 4);
        const grain = valueNoise(3329);
        const tarnish = fbm(3313, 3);
        const lost = ((yield pixelTextureWork(mw, mh, function* (d) {
            for (let y = 0; y < mh; y++) {
                for (let x = 0; x < mw; x++) {
                    const f = flakes(x * 0.09, y * 0.09) + 0.12 * grain(x * 0.8, y * 0.8);
                    const i = (y * mw + x) * 4;
                    d[i + 3] = f > 0.75 ? 255 : f > 0.69 ? 128 : 0;
                }
                yield;
            }
        })) as THREE.CanvasTexture).image as HTMLCanvasElement;
        const dull = ((yield pixelTextureWork(mw, mh, function* (d) {
            for (let y = 0; y < mh; y++) {
                for (let x = 0; x < mw; x++) {
                    const t = Math.max(0, tarnish(x * 0.024, y * 0.024) - 0.5) * 1.4;
                    const i = (y * mw + x) * 4;
                    d[i] = 40;
                    d[i + 1] = 26;
                    d[i + 2] = 10;
                    d[i + 3] = Math.min(255, t * 0.55 * 255);
                }
                yield;
            }
        })) as THREE.CanvasTexture).image as HTMLCanvasElement;
        ctx.globalCompositeOperation = "source-atop";
        ctx.drawImage(dull, 0, 0, W, H);
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(lost, 0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";
        tex.needsUpdate = true;
    }
}

/**
 * The card propped behind the glass where the price would be: cheap card gone
 * yellow, and on it, in a hurried hand and dark red-black ink, YOUR MIND.
 * The ink has smeared and run.
 */
export function inkCard(card: { w: number; h: number }) {
    return cardKept(card).built.get();
}

const cardKept = (card: { w: number; h: number }) =>
    keep(
        `card ${card.w} ${card.h}`,
        () => cardGround(card),
        (tex) => lettering(Promise.all([loadFont(ITALIC)]), () => cardLetters(tex, card)),
    );

function* cardGround(card: { w: number; h: number }): Work<THREE.CanvasTexture> {
    const W = 512;
    const H = Math.round((W * card.h) / card.w);
    return (yield canvasTextureWork(W, H, (ctx) => paper(ctx, W, H))) as THREE.CanvasTexture;
}

function* cardLetters(tex: THREE.CanvasTexture, card: { w: number; h: number }): Work<void> {
    const W = 512;
    const H = Math.round((W * card.h) / card.w);
    const canvas = tex.image as HTMLCanvasElement;
    yield;
    {
        const ctx = canvas.getContext("2d")!;
        const r = rng(4409);
        const size = H * 0.42;
        const lines: [string, number][] = [
            ["YOUR", H * 0.43],
            ["MIND", H * 0.84],
        ];
        // Each letter set down by hand: leaning, rising and falling a little, not quite the same size.
        const glyphs: { ch: string; x: number; y: number; rot: number; s: number }[] = [];
        for (const [text, base] of lines) {
            ctx.font = `${size}px ${ITALIC.family}`;
            const widths = Array.from(text).map((ch) => ctx.measureText(ch).width * 0.98);
            let x = W / 2 - widths.reduce((a, b) => a + b, 0) / 2 - size * 0.04 + (r() - 0.5) * size * 0.1;
            Array.from(text).forEach((ch, i) => {
                glyphs.push({ ch, x: x + widths[i] / 2, y: base + (r() - 0.5) * size * 0.08, rot: (r() - 0.5) * 0.16 - 0.03, s: 0.93 + r() * 0.14 });
                x += widths[i] + (r() - 0.5) * size * 0.05;
            });
        }
        const write = (dx: number, dy: number, color: string, weight: number) => {
            for (const g of glyphs) {
                ctx.save();
                ctx.translate(g.x + dx, g.y + dy);
                ctx.rotate(g.rot);
                ctx.scale(g.s, g.s);
                ctx.font = `${size}px ${ITALIC.family}`;
                ctx.textAlign = "center";
                ctx.fillStyle = color;
                ctx.strokeStyle = color;
                ctx.lineWidth = weight;
                ctx.lineJoin = "round";
                ctx.strokeText(g.ch, 0, 0);
                ctx.fillText(g.ch, 0, 0);
                ctx.restore();
            }
        };
        // A smear, as if a hand dragged across it while it was wet: faint copies trailing down and right.
        for (let k = 1; k <= 7; k++) write(k * 2.2, k * 1.4, "rgba(96, 16, 10, 0.07)", size * 0.06);
        // The ink, laid heavily (the pen pressed hard), with a redder bloom where it pooled.
        write(0, 0, "rgba(128, 20, 12, 0.6)", size * 0.09);
        write(0, 0, "#360705", size * 0.05);
        // Blots where the nib caught, and one run of ink down from the last letter.
        for (let k = 0; k < 9; k++) {
            const g = glyphs[Math.floor(r() * glyphs.length)];
            ctx.fillStyle = `rgba(54, 7, 5, ${0.5 + r() * 0.4})`;
            ctx.beginPath();
            ctx.arc(g.x + (r() - 0.5) * size * 0.5, g.y - r() * size * 0.6, 1.5 + r() * 3.5, 0, Math.PI * 2);
            ctx.fill();
        }
        const last = glyphs[glyphs.length - 1];
        const runX = last.x - size * 0.12;
        ctx.strokeStyle = "rgba(54, 7, 5, 0.85)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(runX, last.y - size * 0.05);
        ctx.bezierCurveTo(runX + 2, last.y + size * 0.05, runX - 1, last.y + size * 0.12, runX + 1, last.y + size * 0.16);
        ctx.stroke();
        ctx.fillStyle = "rgba(54, 7, 5, 0.9)";
        ctx.beginPath();
        ctx.ellipse(runX + 1, last.y + size * 0.17, 3.2, 4.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // A hasty stroke under it.
        ctx.strokeStyle = "rgba(54, 7, 5, 0.8)";
        ctx.lineWidth = size * 0.035;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(W * 0.2, H * 0.92);
        ctx.quadraticCurveTo(W * 0.5, H * 0.95, W * 0.8, H * 0.9);
        ctx.stroke();
        tex.needsUpdate = true;
    }
}

/** Cheap card, yellowed and foxed, darker and soft at the edges, with a pin hole at the top if it was ever pinned up. */
function* paper(ctx: CanvasRenderingContext2D, W: number, H: number, pinned = true): Work<void> {
    const img = ctx.createImageData(W, H);
    const stain = fbm(4501, 5);
    yield;
    const fine = valueNoise(4519);
    yield;
    const r = rng(4531);
    // Foxing: small brown spots, stamped where they fall.
    const fox = new Float32Array(W * H);
    for (let n = 0; n < 26; n++) {
        const fx = r() * W;
        const fy = r() * H;
        const fr = 1 + r() * 4;
        for (let y = Math.max(0, Math.floor(fy - fr * 2)); y < Math.min(H, fy + fr * 2); y++) {
            for (let x = Math.max(0, Math.floor(fx - fr * 2)); x < Math.min(W, fx + fr * 2); x++) {
                const d2 = (x - fx) ** 2 + (y - fy) ** 2;
                fox[y * W + x] += 0.18 * Math.exp(-d2 / (fr * fr));
            }
        }
    }
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const edge = Math.min(x, W - x, y, H - y) / W;
            const s = stain(x * 0.008, y * 0.008);
            const k = 1 - 0.28 * Math.max(0, s - 0.45) * 2 - 0.25 * Math.exp(-edge / 0.03) - 0.06 * fine(x * 0.7, y * 0.7) - fox[y * W + x];
            const i = (y * W + x) * 4;
            img.data[i] = 168 * k;
            img.data[i + 1] = 152 * k * (0.97 - 0.05 * s);
            img.data[i + 2] = 118 * k * (0.92 - 0.1 * s);
            img.data[i + 3] = 255;
        }
        yield;
    }
    yield putWork(ctx, img);
    if (!pinned) return;
    // The pin hole and the rust it left.
    ctx.fillStyle = "rgba(110, 60, 25, 0.35)";
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.06, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a120c";
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.06, 2.2, 0, Math.PI * 2);
    ctx.fill();
}

/** The playbill's size in metres: a half-sheet bill. */
export const PLAYBILL = { w: 0.5, h: 0.74 };

/**
 * Tonight's bill, letterpress on cheap paper in black and one red, the way
 * theatre bills were set: a line to a size, centred, with rules between. The
 * ink is worn, and the top right corner has torn away. It tells the visitor
 * what this is, and the boxed line at the foot invites them to read more.
 */
export function playbill() {
    return playbillKept().built.get();
}

const playbillKept = () => keep("playbill", playbillGround, (tex) => lettering(Promise.all([loadFont(SC), loadFont(ITALIC)]), () => playbillLetters(tex)));

function* playbillGround(): Work<THREE.CanvasTexture> {
    const W = 512;
    const H = Math.round((W * PLAYBILL.h) / PLAYBILL.w);
    return (yield canvasTextureWork(W, H, function* (ctx) {
        yield paper(ctx, W, H, false);
        tear(ctx, W, H);
    })) as THREE.CanvasTexture;
}

function* playbillLetters(tex: THREE.CanvasTexture): Work<void> {
    const W = 512;
    const H = Math.round((W * PLAYBILL.h) / PLAYBILL.w);
    const px = W / PLAYBILL.w; // pixels per metre
    const canvas = tex.image as HTMLCanvasElement;
    yield;
    {
        // Set the type on its own layer so the wear can be taken out of the ink alone.
        const type = document.createElement("canvas");
        type.width = W;
        type.height = H;
        const ctx = type.getContext("2d")!;
        const BLACK = "#1d1510";
        const RED = "#5e0d08"; // oxblood: a brighter red all but vanishes under the neon
        const maxW = W * 0.86;
        // One centred line: y is the baseline and cap the capital height, both in metres from the top.
        const line = (text: string, family: string, cap: number, y: number, color: string, track = 0) => {
            let size = cap * px * 1.5;
            ctx.font = `${size}px ${family}`;
            const t = track * px;
            const width = () => Array.from(text).reduce((a, ch) => a + ctx.measureText(ch).width, 0) + t * (text.length - 1);
            // Too long for the measure: set it smaller, as a compositor would.
            if (width() > maxW) {
                size *= maxW / width();
                ctx.font = `${size}px ${family}`;
            }
            let x = W / 2 - width() / 2;
            ctx.fillStyle = color;
            for (const ch of text) {
                ctx.fillText(ch, x, y * px);
                x += ctx.measureText(ch).width + t;
            }
        };
        const rule = (y: number, w: number, color = BLACK, double = false) => {
            ctx.fillStyle = color;
            ctx.fillRect(W / 2 - (w * px) / 2, y * px, w * px, 2.2);
            if (double) ctx.fillRect(W / 2 - (w * px) / 2, y * px + 5, w * px, 1);
        };
        const diamond = (y: number) => {
            ctx.fillStyle = BLACK;
            ctx.fillRect(W / 2 - 0.13 * px, y * px - 1, 0.1 * px, 1.6);
            ctx.fillRect(W / 2 + 0.03 * px, y * px - 1, 0.1 * px, 1.6);
            ctx.save();
            ctx.translate(W / 2, y * px);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-5, -5, 10, 10);
            ctx.restore();
        };

        line("TONIGHT", SC.family, 0.022, 0.055, BLACK, 0.016);
        rule(0.07, 0.3, BLACK, true);
        line("The", ITALIC.family, 0.02, 0.112, BLACK);
        line("MAGIC THEATRE", SC.family, 0.034, 0.16, RED, 0.003);
        diamond(0.185);
        line("after Hermann Hesse\u2019s", ITALIC.family, 0.024, 0.232, BLACK);
        line("STEPPENWOLF", SC.family, 0.039, 0.29, BLACK, 0.003);
        line("1927", ITALIC.family, 0.02, 0.324, BLACK);
        rule(0.342, 0.22);
        line("Entrance not for everybody.", ITALIC.family, 0.018, 0.378, BLACK);
        line("For madmen only.", ITALIC.family, 0.018, 0.407, BLACK);
        // The invitation, boxed in red at the foot, and the largest thing on the bill.
        ctx.strokeStyle = RED;
        ctx.lineWidth = 3;
        ctx.strokeRect(W * 0.06, 0.435 * px, W * 0.88, 0.265 * px);
        ctx.lineWidth = 1;
        ctx.strokeRect(W * 0.06 + 6, 0.435 * px + 6, W * 0.88 - 12, 0.265 * px - 12);
        line("THE PROGRAMME", SC.family, 0.036, 0.505, RED, 0.004);
        line("read me", ITALIC.family, 0.07, 0.635, RED);
        line("No. 1  \u00b7  printed for the house", ITALIC.family, 0.0095, 0.725, BLACK);
        yield;

        // Worn type: the ink lost in specks where the press was hungry.
        const wear = valueNoise(5101);
        yield;
        const mask = ((yield pixelTextureWork(W >> 1, H >> 1, function* (d) {
            for (let y = 0; y < H >> 1; y++) {
                for (let x = 0; x < W >> 1; x++) {
                    const v = wear(x * 0.35, y * 0.35) * 0.7 + wear(x * 1.3 + 50, y * 1.3) * 0.3;
                    d[(y * (W >> 1) + x) * 4 + 3] = v > 0.66 ? 230 : v > 0.6 ? 90 : 0;
                }
                yield;
            }
        })) as THREE.CanvasTexture).image as HTMLCanvasElement;
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(mask, 0, 0, W, H);

        const out = canvas.getContext("2d")!;
        out.globalAlpha = 0.92;
        out.drawImage(type, 0, 0);
        out.globalAlpha = 1;
        tear(out, W, H);
        tex.needsUpdate = true;
    }
}

/** The torn top right corner: the dark backing board behind it, and a pale edge of torn fibres. */
function tear(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const r = rng(5203);
    // The corner itself, then the ragged line of the tear from the top edge round to the right edge, bowing inward.
    const pts: [number, number][] = [[W, 0]];
    const n = 10;
    for (let i = 0; i <= n; i++) {
        const f = i / n;
        const bow = Math.sin(f * Math.PI) * W * 0.035;
        const jx = i === 0 || i === n ? 0 : (r() - 0.5) * 7;
        const jy = i === 0 || i === n ? 0 : (r() - 0.5) * 7;
        pts.push([W * (0.76 + 0.24 * f) - bow + jx, H * 0.11 * f + bow + jy]);
    }
    ctx.fillStyle = "#15100c";
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(236, 224, 196, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.slice(1).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
}
