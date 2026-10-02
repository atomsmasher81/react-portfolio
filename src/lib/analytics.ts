// One call sends an event to both Google Analytics and Microsoft Clarity.
// In Clarity the event name becomes a filter for session recordings, so every
// GA event here also answers "show me the people who did this".
//
// Every event carries the side of the site the visitor is on (work or life).
// In development nothing is sent; events are logged to the console instead.
// Both scripts load late (components/Analytics.tsx); until then, calls queue.

type Params = Record<string, string | number | boolean | undefined>;

type Gtag = (command: "event" | "set" | "config" | "js", ...args: unknown[]) => void;
type Clarity = (command: "event" | "set" | "identify" | "upgrade", ...args: unknown[]) => void;

declare global {
    interface Window {
        gtag?: Gtag;
        clarity?: Clarity;
    }
}

const currentLens = () => document.querySelector("[data-lens]")?.getAttribute("data-lens") ?? undefined;

// `key` marks a moment that matters (booking a call, reaching out): Clarity then
// keeps the whole recording of that session even if it would sample it out.
export function track(name: string, params: Params = {}, { key = false } = {}) {
    if (typeof window === "undefined") return;
    const payload = { lens: currentLens(), ...params };
    if (process.env.NODE_ENV !== "production") {
        console.debug("[track]", name, payload);
        return;
    }
    window.gtag?.("event", name, payload);
    window.clarity?.("event", name);
    if (key) window.clarity?.("upgrade", name);
}

// Session-level labels in Clarity, for filtering recordings (e.g. lens = life).
export function tag(key: string, value: string) {
    if (typeof window === "undefined" || process.env.NODE_ENV !== "production") return;
    window.clarity?.("set", key, value);
}
