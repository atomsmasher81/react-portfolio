import { prepareEnvTextures } from "@/components/v2/theatre3d/env-textures";
import { prepareShell } from "@/components/v2/theatre3d/env-shell";
import { prepareDoorTextures } from "@/components/v2/theatre3d/door-textures";
import { prepareDoorShapes } from "@/components/v2/theatre3d/door-geometry";
import { doorVariant } from "@/components/v2/theatre3d/door-variants";
import { prepareMarqueeTextures } from "@/components/v2/theatre3d/marquee-textures";
import { prepareBoothLettering } from "@/components/v2/theatre3d/marquee-booth";
import { prepareSilver } from "@/components/v2/theatre3d/mirror-glass";
import { prepareFrame } from "@/components/v2/theatre3d/mirror-frame";
import { preparePhrases } from "@/components/v2/theatre3d/mirror-breath";
import { track } from "@/components/v2/theatre3d/readiness";

// Everything the corridor paints and shapes from code, done beforehand a slice
// at a time while the page is idle (textures.ts), so that when the corridor
// is built nothing holds the page up: every texture and shape is already there.

const doorsUpTo = (n: number) => Array.from({ length: n }, (_, i) => doorVariant(i));

/** The corridor's surfaces. */
export const prepareCorridorShell = () => Promise.all([prepareEnvTextures(), prepareShell()]);

/** The marquee and its box office, lettering and all. */
export const prepareMarquee = () => Promise.all([prepareMarqueeTextures(), prepareBoothLettering()]);

/** The first `n` doors. */
export const prepareDoors = (n: number) => Promise.all([prepareDoorTextures(doorsUpTo(n)), prepareDoorShapes(doorsUpTo(n))]);

/** Door `i` (0-based) alone. */
export const prepareDoor = (i: number) => Promise.all([prepareDoorTextures([doorVariant(i)]), prepareDoorShapes([doorVariant(i)])]);

/** The mirror, and the phrases it may write. */
export const prepareMirror = (words: string[]) => Promise.all([prepareSilver(), prepareFrame(), preparePhrases(words.length ? words.join("\n").split("\n") : [])]);

/**
 * What's seen from the entrance: the corridor, the first `doors` doors, and the marquee and box office
 * (the waiting card says which: readiness.ts). In that order: the box office's lettering waits for its type,
 * so it's last, and nothing waits behind it.
 */
export function prepareEntrance(doors: number) {
    return Promise.all([track("corridor", prepareCorridorShell()), track("doors", prepareDoors(doors)), track("marquee", prepareMarquee())]);
}

/** All of it: the corridor with `doors` doors and the mirror's `words`. */
export function prepareCorridor(doors: number, words: string[]) {
    return Promise.all([prepareEntrance(doors), track("mirror", prepareMirror(words))]);
}
