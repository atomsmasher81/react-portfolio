'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Copy, Eye, RotateCcw, RotateCw } from "lucide-react";
import { LitButton, PlainButton, Playbill, focusRing, ink, useModal } from "@/components/v2/theatre3d/theatre-nav-ui";

// The mirror asking to see you. It only asks; the camera starts on an explicit
// "Let it look", and while the browser's own question is up it says so. Every
// way it can fail gets a plain explanation and a way out, worked out from the
// error itself and from what the browser says the site's camera permission is
// (navigator.permissions, where there is one), never from the message alone:
//
//   permission denied or not yet given, and the browser said no   → blocked for this site: how to allow it here
//   permission granted, but this page was refused earlier         → the browser needs a reload to notice (Reload,
//                                                                    which brings you back to the mirror)
//   permission granted, and still refused                         → the computer is keeping the camera from the
//                                                                    browser (macOS / Windows / Linux steps)
//   the question closed unanswered, no camera, the camera busy, plain http, an app's built-in browser, anything else
//
// It watches the permission: switched to "granted" while it's showing a
// refusal, it tries again by itself. Every failure shows the browser's own
// words (name: message, and the permission) in a small line, for diagnosis.
// If it closes while the browser is still asking, a camera that turns up
// afterwards is switched straight off.

export type CameraProblem = "denied" | "stale" | "system" | "dismissed" | "notfound" | "inuse" | "insecure" | "unsupported" | "other";

export type MirrorAskState =
    | { phase: "ask" }
    | { phase: "waiting"; slow?: boolean }
    | {
          phase: "failed";
          problem: CameraProblem;
          /** The browser's own words: "Name: message", and what the permission said. */
          detail?: string;
          /** How many times in a row it's been refused (the second time, the card says so). */
          tries?: number;
      };

export const MIRROR_CONSTRAINTS: MediaStreamConstraints = {
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
};

/** Why the camera can't even be asked for here, if it can't (and the browser's side of it). */
export function cameraUnavailable(): CameraProblem | null {
    if (typeof window === "undefined") return "unsupported";
    if (!window.isSecureContext) return "insecure";
    if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
    return null;
}
function unavailableDetail(p: CameraProblem) {
    if (typeof window === "undefined") return undefined;
    return p === "insecure" ? `isSecureContext: false (${window.location.protocol}//${window.location.host})` : `navigator.mediaDevices.getUserMedia: ${typeof navigator.mediaDevices?.getUserMedia}`;
}

/** What a getUserMedia failure means, from the error alone (MirrorAsk also weighs the permission). */
export function cameraProblem(e: unknown): { problem: CameraProblem; detail?: string } {
    const name = (e as { name?: string })?.name ?? "";
    const message = (e as { message?: string })?.message ?? "";
    const detail = [name, message].filter(Boolean).join(": ").slice(0, 160) || String(e).slice(0, 160) || undefined;
    switch (name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
            if (/dismiss/i.test(message)) return { problem: "dismissed", detail };
            if (/system/i.test(message)) return { problem: "system", detail };
            return { problem: "denied", detail };
        case "NotFoundError":
        case "DevicesNotFoundError":
        case "OverconstrainedError":
        case "ConstraintNotSatisfiedError":
            return { problem: "notfound", detail };
        case "NotReadableError":
        case "TrackStartError":
        case "AbortError":
            return { problem: "inuse", detail };
        case "SecurityError":
            return { problem: cameraUnavailable() ?? "unsupported", detail };
        case "TypeError":
            return { problem: cameraUnavailable() ?? "other", detail };
        default:
            return { problem: "other", detail };
    }
}

type Perm = PermissionState | "unknown";

/** The site's camera permission, where the browser will say (Chrome, Edge, Firefox, Safari 16+). */
async function cameraPermission(): Promise<PermissionStatus | null> {
    try {
        return (await navigator.permissions?.query({ name: "camera" as PermissionName })) ?? null;
    } catch {
        return null;
    }
}

// This page has been refused the camera by the site's permission. Browsers (Chrome
// above all) hold on to that refusal for the life of the page, even after the
// permission is switched to Allow: then only a reload helps. (Module level: it's
// about this document, not about one opening of the question.)
let refusedHere = false;

// Coming back from that reload: where to go, and that the mirror should ask again.
const RETURN = "kg-theatre-return";

/** Reload the page and come back to the mirror, its question open again. */
export function reloadToMirror() {
    try {
        window.sessionStorage.setItem(RETURN, JSON.stringify({ to: "mirror", t: Date.now() }));
    } catch {}
    window.location.reload();
}

/** Just reloaded to come back to the mirror? (Read once: it's cleared.) */
export function takeMirrorReturn() {
    try {
        const raw = window.sessionStorage.getItem(RETURN);
        if (!raw) return false;
        window.sessionStorage.removeItem(RETURN);
        const v = JSON.parse(raw) as { to?: string; t?: number };
        return v.to === "mirror" && typeof v.t === "number" && Date.now() - v.t < 5 * 60_000;
    } catch {
        return false;
    }
}

export interface MirrorAskProps {
    open: boolean;
    /** The camera's on: take the stream (and close this; it shows nothing more until opened again). */
    onStream(stream: MediaStream): void;
    /** Not tonight, never mind, close, or Esc. */
    onClose(): void;
    /** Touch screen: says "on your screen" rather than "near the address bar". */
    touch?: boolean;
}

export function MirrorAsk({ open, onStream, onClose, touch }: MirrorAskProps) {
    const [state, setState] = useState<MirrorAskState | null>(null);
    const stateRef = useRef(state);
    stateRef.current = state;
    const ask = useRef(0); // the current request; anything older that turns up is stopped
    const handed = useRef(onStream);
    handed.current = onStream;

    useEffect(() => {
        ask.current++;
        if (!open) {
            setState(null);
            return;
        }
        // Where the camera can't even be asked for (plain http, an app's browser), say so
        // straight away. Otherwise always ask, and explain whatever actually goes wrong.
        const missing = cameraUnavailable();
        setState(missing ? { phase: "failed", problem: missing, detail: unavailableDetail(missing) } : { phase: "ask" });
    }, [open]);

    // Gone while the browser was still asking: whatever arrives later is stopped.
    useEffect(
        () => () => {
            ask.current++;
        },
        [],
    );

    const look = useCallback(async () => {
        const missing = cameraUnavailable();
        if (missing) {
            setState({ phase: "failed", problem: missing, detail: unavailableDetail(missing) });
            return;
        }
        const id = ++ask.current;
        const before = stateRef.current;
        const tries = before?.phase === "failed" ? (before.tries ?? 1) : 0;
        setState({ phase: "waiting" });
        const slow = window.setTimeout(() => {
            if (ask.current === id) setState((s) => (s?.phase === "waiting" ? { phase: "waiting", slow: true } : s));
        }, 9000);
        try {
            const stream = await navigator.mediaDevices.getUserMedia(MIRROR_CONSTRAINTS);
            if (ask.current !== id) {
                stream.getTracks().forEach((t) => t.stop());
                return;
            }
            refusedHere = false;
            setState(null);
            handed.current(stream);
        } catch (e) {
            if (ask.current !== id) return;
            // what was refused, weighed against what the browser says the site may do
            const base = cameraProblem(e);
            const perm: Perm = (await cameraPermission())?.state ?? "unknown";
            if (ask.current !== id) return;
            let problem = base.problem;
            if (problem === "denied" || problem === "system") {
                if (perm === "granted") problem = refusedHere ? "stale" : "system";
                else if (perm === "denied" || perm === "prompt") problem = base.problem;
                if (problem === "denied") refusedHere = true;
            }
            const detail = `${base.detail ?? "unknown error"} · camera permission: ${perm}`;
            setState({ phase: "failed", problem, detail, tries: tries + 1 });
        } finally {
            window.clearTimeout(slow);
        }
    }, []);

    // Watch the site's camera permission while the question's open. Switched to Allow
    // while a refusal is showing: try again straight away.
    useEffect(() => {
        if (!open) return;
        let alive = true;
        let status: PermissionStatus | null = null;
        const onChange = () => {
            if (!alive || !status) return;
            if (status.state === "denied") refusedHere = true;
            const s = stateRef.current;
            if (status.state === "granted" && s?.phase === "failed" && (s.problem === "denied" || s.problem === "dismissed" || s.problem === "system")) look();
        };
        cameraPermission().then((st) => {
            if (!alive || !st) return;
            status = st;
            if (st.state === "denied") refusedHere = true;
            st.addEventListener("change", onChange);
        });
        return () => {
            alive = false;
            status?.removeEventListener("change", onChange);
        };
    }, [open, look]);

    const close = useCallback(() => {
        ask.current++;
        setState(null);
        onClose();
    }, [onClose]);

    return <MirrorAskView state={open ? state : null} onLook={look} onClose={close} onReload={reloadToMirror} touch={touch} />;
}

/** The mirror's question, in any one of its states (no camera logic: MirrorAsk drives it). */
export function MirrorAskView({
    state,
    onLook,
    onClose,
    onReload = reloadToMirror,
    touch,
}: {
    state: MirrorAskState | null;
    onLook(): void;
    onClose(): void;
    /** Reload the page (and come back to the mirror). */
    onReload?(): void;
    touch?: boolean;
}) {
    const reduced = useReducedMotion();
    const box = useRef<HTMLDivElement>(null);
    const main = useRef<HTMLButtonElement>(null);
    const open = state !== null;
    const key = !state ? "" : state.phase === "failed" ? `failed-${state.problem}-${state.tries ?? 1}` : state.phase;
    // focus kept inside, Esc closes, the corridor doesn't walk while it asks, focus given back after
    useModal("mirror", open, box, onClose, main);

    const words = state ? say(state, !!touch, onReload) : null;

    return (
        <AnimatePresence>
            {state && words && (
                <motion.div key="mirror-ask" className="fixed inset-0 z-[35]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.12 : 0.4 }}>
                    {/* the corridor dims a little; the glass stays in view above */}
                    <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgba(5,3,3,0.82)_0%,rgba(5,3,3,0.45)_45%,rgba(5,3,3,0.12)_100%)]" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-[96px] flex justify-center px-4 md:bottom-8">
                        <motion.div
                            ref={box}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="mirror-ask-title"
                            aria-describedby="mirror-ask-body"
                            data-theatre-dialog="mirror"
                            className="pointer-events-auto w-full max-w-[460px]"
                            initial={{ y: reduced ? 0 : 14 }}
                            animate={{ y: 0 }}
                            exit={{ y: reduced ? 0 : 8 }}
                            transition={{ duration: reduced ? 0.12 : 0.45, ease: [0.2, 0.7, 0.2, 1] }}
                        >
                            <Playbill className="px-5 pb-5 pt-4 md:px-7 md:pb-6 md:pt-5">
                                <AnimatePresence mode="wait" initial={false}>
                                    <motion.div
                                        key={key}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: reduced ? 0.08 : 0.2 }}
                                    >
                                        <FocusOnArrival box={box} main={main} />
                                        <p className={ink.eyebrow}>The mirror</p>
                                        <h2 id="mirror-ask-title" className={`${ink.title} mt-1 flex items-center gap-3 text-[22px]`} aria-live="polite">
                                            {state.phase === "waiting" && <Ember />}
                                            {words.title}
                                        </h2>
                                        <div id="mirror-ask-body" className={`${ink.body} mt-2 space-y-2`}>
                                            {words.body}
                                        </div>
                                        <div className="mt-4 flex flex-col gap-2.5 md:flex-row">
                                            {words.lit && (
                                                <LitButton ref={main} icon={words.lit.icon} onClick={words.lit.onClick ?? onLook} className="w-full md:w-auto">
                                                    {words.lit.label}
                                                </LitButton>
                                            )}
                                            <PlainButton onClick={onClose} className="w-full md:w-auto">
                                                {words.close}
                                            </PlainButton>
                                        </div>
                                        {words.small && <p className={`${ink.hint} mt-3 not-italic text-[#b9a38c]`}>{words.small}</p>}
                                        {state.phase === "failed" && state.detail && (
                                            <p className="mt-3 break-words font-mono text-[12.5px] leading-snug text-[#9c8672]">
                                                <span className="sr-only">Details: </span>
                                                {state.detail}
                                            </p>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </Playbill>
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// When what the mirror says changes, the new card's main button takes focus (once it's
// there: the old card fades out first), unless focus has gone somewhere else meanwhile.
function FocusOnArrival({ box, main }: { box: RefObject<HTMLDivElement | null>; main: RefObject<HTMLButtonElement | null> }) {
    useEffect(() => {
        const a = document.activeElement;
        if (!a || a === document.body || box.current?.contains(a)) (main.current ?? box.current?.querySelector<HTMLElement>("button"))?.focus({ preventScroll: true });
        // only on arrival
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
}

function Ember() {
    return (
        <span aria-hidden className="relative inline-flex h-3.5 w-3.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff8f66] opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[#ffb36b] shadow-[0_0_10px_rgba(255,140,80,0.9)]" />
        </span>
    );
}

const PRIVATE = "Nothing is recorded or sent anywhere: the picture stays in the glass, on this screen, and the camera goes off when you look away or walk on.";

type Words = { title: string; body: ReactNode; lit?: { label: string; icon?: ReactNode; onClick?: () => void }; close: string; small?: string };

function say(state: MirrorAskState, touch: boolean, reload: () => void): Words {
    if (state.phase === "ask")
        return {
            title: "The mirror wants to see you.",
            body: <p>It would like to use your camera, so that you can see yourself in the glass.</p>,
            lit: { label: "Let it look", icon: <Eye strokeWidth={1.6} /> },
            close: "Not tonight",
            small: PRIVATE,
        };
    if (state.phase === "waiting")
        return {
            title: "Waiting for your camera…",
            body: (
                <>
                    <p>Your browser is asking whether this page may use the camera. Answer it {touch ? "on your screen" : "near the address bar"}.</p>
                    {state.slow && <p className="text-[#f1e2cc]">Still waiting. If you can&apos;t see the question, look for a camera icon in the address bar, or close this and try again.</p>}
                </>
            ),
            close: "Never mind",
            small: PRIVATE,
        };
    const again = { label: "Try again", icon: <RotateCcw strokeWidth={1.6} /> };
    const reloadLit = { label: "Reload the page", icon: <RotateCw strokeWidth={1.6} />, onClick: reload };
    const box = "rounded-[5px] border border-[#8f7142]/40 bg-[#1b100c] px-3 py-2 text-[#f1e2cc]";
    const reloadLink = (
        <button type="button" onClick={reload} className={`${ink.hint} -mx-1 min-h-[44px] rounded-[5px] px-1 text-left not-italic text-[#f1d9bd] underline decoration-[#8f7142] underline-offset-4 hover:text-[#fff1de] ${focusRing}`}>
            Reload the page (you&apos;ll come back to the mirror)
        </button>
    );
    const again2 = (state.tries ?? 1) > 1;
    switch (state.problem) {
        case "denied":
            return {
                title: again2 ? "Still blocked for this site." : "The camera is blocked for this site.",
                body: (
                    <>
                        <p>{again2 ? "The browser still says no. To let the mirror look:" : "The browser didn't allow it. To let the mirror look:"}</p>
                        <p className={box}>{allowHelp()}</p>
                        <p>If you&apos;ve allowed it and nothing changes, reload the page: browsers often only notice a changed setting after a reload.</p>
                        {reloadLink}
                    </>
                ),
                lit: again,
                close: "Never mind",
            };
        case "stale":
            return {
                title: "Allowed. Now the page needs a reload.",
                body: (
                    <>
                        <p>The camera is allowed for this site now, but the browser only takes that in after the page is reloaded. The theatre will bring you straight back to the mirror.</p>
                        <p className="text-[#c4ae95]">If it still says no after that, your computer may be keeping the camera from the browser: {systemHelp()}</p>
                    </>
                ),
                lit: reloadLit,
                close: "Never mind",
            };
        case "system":
            return {
                title: "Your computer is keeping the camera from the browser.",
                body: (
                    <>
                        <p>This site is allowed to use the camera, but the browser itself isn&apos;t: that&apos;s set in the system&apos;s privacy settings.</p>
                        <p className={box}>{systemHelp()}</p>
                        <p>Changed the site&apos;s camera setting just now? Then a reload may be all it needs.</p>
                        {reloadLink}
                    </>
                ),
                lit: again,
                close: "Never mind",
            };
        case "dismissed":
            return {
                title: "The question went unanswered.",
                body: <p>The browser&apos;s question was closed before it was answered. The mirror can ask again.</p>,
                lit: again,
                close: "Never mind",
            };
        case "notfound":
            return {
                title: "There's no camera here to look through.",
                body: <p>No camera was found on this device. If one is plugged in, check that it&apos;s connected, then try again.</p>,
                lit: again,
                close: "Never mind",
            };
        case "inuse":
            return {
                title: "The camera is busy elsewhere.",
                body: <p>Another app or tab seems to be using it (a video call, perhaps). Close that, then try again.</p>,
                lit: again,
                close: "Never mind",
            };
        case "insecure":
            return {
                title: "The mirror can't ask for a camera here.",
                body: (
                    <p>
                        Browsers only lend the camera to secure pages, and this one was opened over plain http
                        {typeof window !== "undefined" ? ` (${window.location.host})` : ""}. Open it over https, or as localhost on the computer that&apos;s serving it.
                    </p>
                ),
                close: "Close",
            };
        case "unsupported":
            return {
                title: "This browser won't lend the mirror a camera.",
                body: (
                    <>
                        <p>Some browsers don&apos;t let pages use the camera at all, often the ones built into apps (Instagram, Gmail, LinkedIn…). Open this page in Safari or Chrome and the mirror can ask there.</p>
                        <CopyLink />
                    </>
                ),
                close: "Close",
            };
        default:
            return {
                title: "The camera wouldn't start.",
                body: <p>Something went wrong on the way to the glass. You can try again, or reload the page if it keeps happening.</p>,
                lit: again,
                close: "Never mind",
            };
    }
}

function CopyLink() {
    const [done, setDone] = useState<"" | "copied" | "failed">("");
    const href = typeof window !== "undefined" ? window.location.href : "";
    return (
        <div className="flex flex-col gap-2 pt-1">
            <PlainButton
                icon={<Copy strokeWidth={1.6} />}
                onClick={() => {
                    if (!navigator.clipboard) {
                        setDone("failed");
                        return;
                    }
                    navigator.clipboard.writeText(href).then(
                        () => setDone("copied"),
                        () => setDone("failed"),
                    );
                }}
                className="w-full md:w-auto md:self-start"
            >
                {done === "copied" ? "Copied" : "Copy the link"}
            </PlainButton>
            {done === "failed" && <p className="select-all break-all rounded-[5px] bg-[#1b100c] px-3 py-2 font-mono text-[14px] text-[#f1e2cc]">{href}</p>}
            <span className="sr-only" aria-live="polite">
                {done === "copied" ? "Link copied" : ""}
            </span>
        </div>
    );
}

function browser() {
    if (typeof navigator === "undefined") return "other";
    const ua = navigator.userAgent;
    // (an iPad asking for desktop sites says Macintosh, but has touch; desktop Chrome or Edge with a touch screen is still desktop)
    const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1 && !/Chrome\/|Edg\//.test(ua));
    if (iOS) return /CriOS/.test(ua) ? "ios-chrome" : /FxiOS|EdgiOS|OPiOS/.test(ua) ? "ios-other" : "ios-safari";
    if (/Android/.test(ua)) return "android";
    if (/Firefox\//.test(ua)) return "firefox";
    if (/Edg\//.test(ua)) return "edge";
    if (/Chrome\//.test(ua)) return "chrome";
    if (/Safari\//.test(ua)) return "safari";
    return "other";
}

function allowHelp() {
    switch (browser()) {
        case "ios-safari":
            return "Tap the page-settings button (aA) in the address bar ▸ Website Settings ▸ Camera ▸ Allow, then try again. If it stays blocked: iPhone Settings ▸ Safari ▸ Camera.";
        case "ios-chrome":
            return "Open your iPhone's Settings ▸ Chrome, turn Camera on, then come back and try again.";
        case "ios-other":
            return "Open your iPhone's Settings, find this browser, turn Camera on, then come back and try again.";
        case "android":
            return "Tap the icon at the left of the address bar ▸ Permissions ▸ Camera ▸ Allow, then try again.";
        case "firefox":
            return "Click the crossed-out camera in the address bar and clear the block, then try again.";
        case "edge":
            return "Click the lock at the left of the address bar ▸ Permissions for this site ▸ Camera ▸ Allow, then try again.";
        case "chrome":
            return "Click the site-settings icon at the left of the address bar, switch Camera on (or set it to Allow), then try again.";
        case "safari":
            return "In the menu bar, Safari ▸ Settings for This Website… ▸ Camera ▸ Allow, then try again.";
        default:
            return "Allow the camera for this site in your browser's site settings (usually behind the icon by the address), then try again.";
    }
}

function systemHelp() {
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
    if (/Windows/.test(ua)) return "On Windows: Settings ▸ Privacy & security ▸ Camera: turn on Camera access and Let apps access your camera, and make sure your browser is allowed. Then close the browser completely, open it again, and come back.";
    if (/Android/.test(ua)) return "On Android: Settings ▸ Apps ▸ your browser ▸ Permissions ▸ Camera ▸ Allow. Then try again.";
    if (/Macintosh/.test(ua) && !/iPhone|iPad/.test(ua)) return "On a Mac: System Settings ▸ Privacy & Security ▸ Camera, and turn on your browser (Google Chrome, Safari…). Then quit the browser completely, open it again, and come back.";
    if (/Linux/.test(ua)) return "On Linux: check that no other app holds the camera and that your browser may use it (for a Snap or Flatpak browser, its camera permission, e.g. `snap connect` or Flatseal). Then restart the browser.";
    return "Let your browser use the camera in your device's privacy settings, then restart the browser and come back.";
}
