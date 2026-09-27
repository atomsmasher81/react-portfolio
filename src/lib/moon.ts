// Moon phase from the average synodic month, anchored to a known new moon
// (2000-01-06 18:14 UTC). Accurate to within about a day, which is plenty here.

const SYNODIC_DAYS = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

export interface MoonPhase {
    /** 0 = new, 0.5 = full, back to 1 = new */
    fraction: number;
    /** 0..1 share of the disc that's lit */
    illumination: number;
    ageDays: number;
    name: string;
    waxing: boolean;
    daysToFull: number;
}

export function moonPhase(date: Date = new Date()): MoonPhase {
    const days = (date.getTime() - KNOWN_NEW_MOON) / 86_400_000;
    const ageDays = ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
    const fraction = ageDays / SYNODIC_DAYS;
    const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
    const waxing = fraction < 0.5;
    const daysToFull = (((0.5 - fraction + 1) % 1) * SYNODIC_DAYS);

    const names: [number, string][] = [
        [0.0339, "New moon"],
        [0.216, "Waxing crescent"],
        [0.284, "First quarter"],
        [0.466, "Waxing gibbous"],
        [0.534, "Full moon"],
        [0.716, "Waning gibbous"],
        [0.784, "Last quarter"],
        [0.966, "Waning crescent"],
        [1, "New moon"],
    ];
    const name = names.find(([limit]) => fraction < limit)?.[1] ?? "New moon";

    return { fraction, illumination, ageDays, name, waxing, daysToFull };
}

// SVG path for the lit part of a 100×100 moon disc.
export function litPath(fraction: number): string {
    const k = Math.cos(2 * Math.PI * fraction); // 1 = new, -1 = full
    const rx = Math.abs(k) * 50;
    const waxing = fraction < 0.5;
    const edgeSweep = waxing ? 1 : 0; // lit limb: right side when waxing
    const termSweep = waxing ? (k > 0 ? 0 : 1) : k > 0 ? 1 : 0;
    return `M50 0 A50 50 0 0 ${edgeSweep} 50 100 A${rx} 50 0 0 ${termSweep} 50 0 Z`;
}
