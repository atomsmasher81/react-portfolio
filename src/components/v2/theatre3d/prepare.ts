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

/** The mirror, and the phrases it may write. */
export const prepareMirror = (words: string[]) => Promise.all([prepareSilver(), prepareFrame(), preparePhrases(words.length ? words.join("\n").split("\n") : [])]);

/** All of it: the corridor with `doors` doors and the mirror's `words`. */
export function prepareCorridor(doors: number, words: string[]) {
    return Promise.all([prepareCorridorShell(), prepareMarquee(), prepareDoors(doors), prepareMirror(words)]);
}
