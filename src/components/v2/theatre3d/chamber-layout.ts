import { fell, fellSC } from "@/components/v2/theatre-fonts";
import type { Room, RoomImage } from "@/data/v2/theatre";
import { moonPhase, type MoonPhase } from "@/lib/moon";

// How the words and pictures of a room are laid out on the face of the
// shrine's stele, worked out in metres before anything is carved or drawn.
// One column, top to bottom: the plate (title) and a carved rule, then the
// moon or the photograph, the carved words (or the letter), the quote in its
// cartouche, and any other prints. The face keeps its width and grows taller
// when there's more to say: the letters never drop below a size that still
// reads when the face fills a phone held upright.

/** The area the visitor needs to read, in chamber space, facing +Z. */
export interface ChamberShot {
    center: [number, number, number];
    width: number;
    height: number;
}

export const STELE = {
    faceW: 0.9, // width of the inscribed face (m)
    depth: 0.2,
    padX: 0.075,
    padTop: 0.085,
    padBottom: 0.1,
    minFaceH: 1.05,
    /** Words beyond this push the face taller instead of shrinking the type. */
    targetFaceH: 1.42,
};

/** The altar block the stele stands on, and the low step under that. */
export const ALTAR = { w: 1.64, d: 0.72, h: 0.62, z: 0.04 };
export const STEP = { w: 2.06, d: 1.06, h: 0.16, z: 0.12 };
/** The moulded base the stele is set into. */
export const BASE_H = 0.07;
/** Bottom of the inscribed face. */
export const FACE_Y0 = ALTAR.h + BASE_H;
/** The face's plane (the stele is centred on z = 0). */
export const FACE_Z = STELE.depth / 2;
export const CAP_H = 0.1;

/** Sizes of type, as the em size in metres. */
export const TYPE = {
    bodyMax: 0.062,
    bodyMin: 0.044,
    bodyStep: 0.002,
    line: 1.36,
    italicLine: 1.3,
    title: 0.068,
    titleMin: 0.052,
    /** the smallest a very long plate may go */
    titleLong: 0.044,
    titleTrack: 0.06, // extra letter spacing, in em
    attribution: 0.044,
    caption: 0.047,
    date: 0.038,
    moonLabel: 0.042,
    letterMin: 0.047,
};

const GAP = 0.06;

/* ------------------------------------------------------------- fonts */

export type Face = "roman" | "italic" | "sc";

export function cssFont(face: Face, px: number) {
    const family = face === "sc" ? fellSC.style.fontFamily : fell.style.fontFamily;
    return `${face === "italic" ? "italic " : ""}${px}px ${family}`;
}

let fontsReady: Promise<void> | null = null;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** IM Fell (roman and italic) and IM Fell SC, loaded before anything is measured or drawn. */
export function loadFonts() {
    if (fontsReady) return fontsReady;
    const p = (async () => {
        if (typeof document === "undefined" || !document.fonts) return;
        const want = [cssFont("roman", 40), cssFont("italic", 40), cssFont("sc", 40)];
        const attempt = () => Promise.all(want.map((f) => document.fonts.load(f, "Aa")));
        await Promise.race([attempt().catch(() => []), wait(5000)]);
        if (!want.every((f) => document.fonts.check(f, "Aa"))) {
            await Promise.race([document.fonts.ready.then(attempt).catch(() => []), wait(2500)]);
            // Not there yet: carve with the fallback this time, try again next time.
            if (!want.every((f) => document.fonts.check(f, "Aa"))) fontsReady = null;
        }
    })();
    fontsReady = p;
    return p;
}

/* ---------------------------------------------------------- measuring */

const REF = 100;
let mctx: CanvasRenderingContext2D | null = null;
const widths = new Map<string, number>();

/** Width of `text` in em. */
export function measure(face: Face, text: string) {
    const key = face + "\u0000" + text;
    let w = widths.get(key);
    if (w === undefined) {
        mctx ??= document.createElement("canvas").getContext("2d")!;
        mctx.font = cssFont(face, REF);
        w = mctx.measureText(text).width / REF;
        widths.set(key, w);
    }
    return w;
}

/** Forget measurements (after the real fonts arrive, widths made with the fallback are wrong). */
export function resetMeasure() {
    widths.clear();
}

export interface Line {
    words: string[];
    /** each word's width, em (tracking included) */
    widths: number[];
    /** natural width with single spaces, em */
    width: number;
    space: number;
    /** last line of a paragraph (never justified) */
    last: boolean;
}

/** Straight quotes to curly ones (IM Fell's straight double quote is a closing quote). */
export function typeset(text: string) {
    return text
        .replace(/(^|[\s([{\u2014-])"/g, "$1\u201C")
        .replace(/"/g, "\u201D")
        .replace(/(^|[\s([{\u2014-])'/g, "$1\u2018")
        .replace(/'/g, "\u2019")
        .replace(/--/g, "\u2014")
        .replace(/\.\.\./g, "\u2026");
}

/** Greedy word wrap to `maxEm`. "\n" is a hard break; a word too long for a line is split. */
export function wrap(text: string, face: Face, maxEm: number, track = 0): Line[] {
    const out: Line[] = [];
    const space = measure(face, " ") + track;
    const wordW = (w: string) => measure(face, w) + track * w.length;
    for (const hard of typeset(text).split("\n")) {
        const words: string[] = [];
        for (const w of hard.trim().split(/\s+/).filter(Boolean)) {
            if (wordW(w) <= maxEm) {
                words.push(w);
                continue;
            }
            let chunk = "";
            for (const ch of w) {
                if (chunk && wordW(chunk + ch) > maxEm) {
                    words.push(chunk);
                    chunk = "";
                }
                chunk += ch;
            }
            if (chunk) words.push(chunk);
        }
        if (!words.length) {
            out.push({ words: [], widths: [], width: 0, space, last: true });
            continue;
        }
        let cur: string[] = [];
        let curW: number[] = [];
        let w = 0;
        for (const word of words) {
            const ww = wordW(word);
            const next = cur.length ? w + space + ww : ww;
            if (cur.length && next > maxEm) {
                out.push({ words: cur, widths: curW, width: w, space, last: false });
                cur = [word];
                curW = [ww];
                w = ww;
            } else {
                cur.push(word);
                curW.push(ww);
                w = next;
            }
        }
        out.push({ words: cur, widths: curW, width: w, space, last: true });
    }
    return out;
}

/** Two lines of as near equal width as the words allow (null if it can't fit in two). */
function balance(text: string, face: Face, maxEm: number, track: number): Line[] | null {
    const words = typeset(text).trim().split(/\s+/);
    if (words.length < 2) return null;
    let best: Line[] | null = null;
    let bestW = Infinity;
    for (let k = 1; k < words.length; k++) {
        const a = wrap(words.slice(0, k).join(" "), face, Infinity, track)[0];
        const b = wrap(words.slice(k).join(" "), face, Infinity, track)[0];
        const w = Math.max(a.width, b.width);
        if (w <= maxEm && w < bestW) {
            bestW = w;
            best = [{ ...a, last: false }, b];
        }
    }
    return best;
}

/* -------------------------------------------------------------- blocks */

export interface PrintPaper {
    kind: "print";
    src: string;
    w: number;
    h: number;
    /** The picture on the print, from its top-left corner (m). */
    img: { x: number; y: number; w: number; h: number };
    caption: Line[];
    capSize: number;
    capY: number;
    date: string;
    dateSize: number;
    dateY: number;
    seed: number;
}

export interface LetterPaper {
    kind: "letter";
    w: number;
    h: number;
    size: number;
    paras: Line[][];
    padX: number;
    padTop: number;
    signY: number;
    /** Fold lines, metres from the top. */
    folds: number[];
    seed: number;
}

export type Paper = PrintPaper | LetterPaper;

/** Everything has y (from the top of the face, m) and h. */
export type Block =
    | { type: "title"; y: number; h: number; size: number; lines: Line[]; track: number; w: number }
    | { type: "rule"; y: number; h: number }
    | { type: "moon"; y: number; h: number; d: number; label: string; labelSize: number }
    | { type: "text"; y: number; h: number; size: number; paras: Line[][] }
    | { type: "cartouche"; y: number; h: number; w: number; size: number; lines: Line[]; by: Line[]; bySize: number; padX: number; padY: number }
    | { type: "paper"; y: number; h: number; paper: Paper; x: number; tilt: number };

export interface ChamberLayout {
    faceW: number;
    faceH: number;
    colW: number;
    blocks: Block[];
    shot: ChamberShot;
    bodySize: number;
    moon: MoonPhase | null;
    kind: Room["kind"];
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2016-08-27" → "27 August 2016"; anything else as written. */
export function formatDate(d: string) {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(d.trim());
    if (!m) return d.trim();
    const month = MONTHS[Number(m[2]) - 1];
    if (!month) return d.trim();
    return m[3] ? `${Number(m[3])} ${month} ${m[1]}` : `${month} ${m[1]}`;
}

const lineCount = (paras: Line[][]) => paras.reduce((n, p) => n + p.length, 0);

/** Height of wrapped paragraphs at `size`, with half a line between paragraphs. */
export const parasHeight = (paras: Line[][], size: number, lead: number) => lineCount(paras) * size * lead + Math.max(0, paras.length - 1) * size * 0.5;

/** A 32-bit hash of a string (FNV-1a), for seeds and cache keys. */
export function seedOf(s: string) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
}

/** A print: the picture with a white border, its caption in ink on the wide bottom border, and the date. */
function makePrint(img: RoomImage, maxW: number, maxImgH: number, aspect: number): PrintPaper {
    const side = 0.03;
    const top = 0.03;
    let imgW = maxW - 2 * side;
    let imgH = imgW / aspect;
    if (imgH > maxImgH) {
        imgH = maxImgH;
        imgW = imgH * aspect;
    }
    // never so narrow the caption can't breathe
    const w = Math.max(imgW + 2 * side, Math.min(maxW, 0.42));
    const imgX = (w - imgW) / 2;
    const capSize = TYPE.caption;
    const caption = img.caption ? wrap(img.caption, "italic", (w - 2 * side - 0.03) / capSize) : [];
    const date = img.date ? formatDate(img.date) : "";
    const capY = top + imgH + 0.03;
    const capH = caption.length * capSize * TYPE.italicLine;
    const dateY = capY + capH + (caption.length ? 0.004 : 0);
    const dateH = date ? TYPE.date * 1.35 : 0;
    const h = caption.length || date ? dateY + dateH + 0.03 : top + imgH + side * 1.9;
    return { kind: "print", src: img.src, w, h, img: { x: imgX, y: top, w: imgW, h: imgH }, caption, capSize, capY, date, dateSize: TYPE.date, dateY, seed: seedOf(img.src) };
}

function makeLetter(body: string[], size: number): LetterPaper {
    const w = 0.8;
    const padX = 0.07;
    const padTop = 0.085;
    const paras = body.map((p) => wrap(p, "italic", (w - 2 * padX) / size));
    const textH = parasHeight(paras, size, TYPE.italicLine);
    const signY = padTop + textH + 0.035;
    const h = signY + 0.11 + 0.06;
    return { kind: "letter", w, h, size, paras, padX, padTop, signY, folds: [h / 3, (2 * h) / 3], seed: seedOf(body.join("|")) };
}

/**
 * Lay a room out on the face. `aspect(src)` gives each picture's width / height
 * (already loaded), so the face's height is known before anything is drawn.
 */
export function layoutChamber(room: Room, plate: string, aspect: (src: string) => number): ChamberLayout {
    const { faceW, padX, padTop, padBottom } = STELE;
    const colW = faceW - 2 * padX;

    // The plate: small caps, two lines at most if it can help it. A long one
    // (the novel's are up to seventy letters) first gets smaller, then closer
    // set and the full width inside the border, before it takes a third line.
    let tSize = TYPE.title;
    let track = TYPE.titleTrack;
    let titleW = colW;
    const title = plate.trim();
    const fit = () => (title ? wrap(title, "sc", titleW / tSize, track) : []);
    let tLines = fit();
    while (tLines.length > 2 && tSize > TYPE.titleMin + 1e-6) {
        tSize -= 0.002;
        tLines = fit();
    }
    if (tLines.length > 2) {
        track = 0.025;
        titleW = faceW - 0.15;
        tLines = fit();
        while (tLines.length > 2 && tSize > TYPE.titleLong + 1e-6) {
            tSize -= 0.002;
            tLines = fit();
        }
    }
    // two lines: break where they come out most even, never one word left alone
    if (tLines.length === 2) tLines = balance(title, "sc", titleW / tSize, track) ?? tLines;

    const moon = room.kind === "moon" ? moonPhase() : null;
    const body = (room.body ?? []).filter((p) => p.trim());
    const images = room.images ?? [];

    const build = (b: number) => {
        const blocks: Block[] = [];
        let y = padTop;
        let papers = 0;
        const push = (blk: Block, gap = GAP) => {
            blocks.push(blk);
            y += blk.h + gap;
        };
        if (moon) {
            const d = 0.25;
            push({ type: "moon", y, h: d + 0.03 + TYPE.moonLabel * 1.2, d, label: moon.name, labelSize: TYPE.moonLabel }, 0.05);
        }
        if (tLines.length) {
            push({ type: "title", y, h: tLines.length * tSize * 1.18, size: tSize, lines: tLines, track, w: titleW }, 0.012);
            push({ type: "rule", y, h: 0.05 }, 0.045);
        }
        if (room.kind === "photo") {
            const crowded = body.length > 0 || images.length > 0;
            const p = makePrint({ src: room.src, caption: room.caption, date: room.date }, colW + 0.05, crowded ? 0.7 : 0.84, aspect(room.src));
            push({ type: "paper", y, h: p.h, paper: p, x: 0, tilt: 0.01 }, GAP + 0.01);
            papers += p.h + GAP + 0.01;
        }
        if (room.kind === "letter") {
            const p = makeLetter(body, Math.max(b, TYPE.letterMin));
            push({ type: "paper", y, h: p.h, paper: p, x: 0, tilt: -0.012 }, GAP + 0.01);
        } else if (body.length) {
            const paras = body.map((p) => wrap(p, "roman", colW / b));
            push({ type: "text", y, h: parasHeight(paras, b, TYPE.line), size: b, paras });
        }
        if (room.kind === "quote") {
            const size = Math.min(0.07, Math.max(0.052, b * 1.18));
            const cPadX = 0.055;
            const cPadY = 0.05;
            const inner = colW - 2 * cPadX;
            const lines = wrap(`“${room.quote.trim()}”`, "italic", inner / size);
            const by = room.by.trim() ? wrap(`— ${room.by.trim()}`, "sc", inner / TYPE.attribution) : [];
            const h = 2 * cPadY + lines.length * size * TYPE.italicLine + (by.length ? 0.022 + by.length * TYPE.attribution * 1.25 : 0);
            push({ type: "cartouche", y, h, w: colW, size, lines, by, bySize: TYPE.attribution, padX: cPadX, padY: cPadY });
        }
        images.forEach((img, i) => {
            const p = makePrint(img, 0.62, 0.5, aspect(img.src));
            const slack = Math.max(0, (colW + 0.05 - p.w) / 2);
            const side = i % 2 === 0 ? -1 : 1;
            push({ type: "paper", y, h: p.h, paper: p, x: side * slack * 0.55, tilt: side * (0.014 + (p.seed % 7) * 0.002) });
            papers += p.h + GAP;
        });
        // the last gap isn't needed
        const contentH = y - (blocks.length ? GAP : 0) + padBottom;
        return { blocks, contentH, wordsH: contentH - papers };
    };

    // The largest type that keeps the words within the usual height.
    let built = build(TYPE.bodyMin);
    let bodySize = TYPE.bodyMin;
    for (let b = TYPE.bodyMax; b > TYPE.bodyMin + 1e-6; b -= TYPE.bodyStep) {
        const r = build(b);
        if (r.wordsH <= STELE.targetFaceH) {
            built = r;
            bodySize = b;
            break;
        }
    }

    // Short rooms: a stele of a decent height, with the words sat a little above the middle.
    const faceH = Math.max(STELE.minFaceH, built.contentH);
    const slack = faceH - built.contentH;
    if (slack > 0) {
        const head = built.blocks.findIndex((b) => b.type !== "title" && b.type !== "rule" && b.type !== "moon");
        if (head >= 0) for (let i = head; i < built.blocks.length; i++) built.blocks[i].y += slack * 0.42;
    }

    const shot: ChamberShot = { center: [0, FACE_Y0 + faceH / 2, FACE_Z + 0.005], width: faceW + 0.06, height: faceH + 0.05 };
    return { faceW, faceH, colW, blocks: built.blocks, shot, bodySize, moon, kind: room.kind };
}

/** Stable key for caching a room's build. */
export function roomKey(room: Room, plate: string, quality: string) {
    return `${quality}|${seedOf(plate + "\u0000" + JSON.stringify(room)).toString(36)}`;
}
