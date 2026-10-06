'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, useMotionValue, type MotionValue } from "framer-motion";
import { fell, fellSC } from "@/components/v2/theatre-fonts";
import {
    AboutPanel,
    ActionBar,
    DoorRail,
    MirrorAsk,
    MirrorAskView,
    NavToggle,
    barFor,
    momentFor,
    useNavVisible,
    useNearestStop,
    walkAt,
    type MirrorAskState,
    type RailStop,
} from "@/components/v2/theatre3d/theatre-nav";

// Dev bench for the theatre's navigation: /theatre-lab/nav. A painted stand-in
// for the 3D (dark red, busy, lamp-lit) with the site's header and phone dock
// sketched in where they really sit, and the nav working on it: scroll (or the
// slider) to walk, knock, go in, come back, ask the mirror (for real: it
// will use your camera). Params:
//   ?s=<scenario>   start in a given state (see SCENARIOS)
//   &bare=1         no bench panel (for screenshots)
//   &touch=1        word things for a touch screen
//   &guides=1       mark the header and dock clearances
// (No sheet of every state in frames: the site sends X-Frame-Options: DENY.
// Pick a scenario from the panel, and use the device toolbar for a phone.)

const DOORS = [
    { id: "taming", plate: "Marvellous Taming of the Steppenwolf" },
    { id: "personality", plate: "Guidance in the Building up of the Personality. Success Guaranteed." },
    { id: "hunt", plate: "Jolly Hunting. Great Hunt in Automobiles." },
    { id: "girls", plate: "All Girls Are Yours. One Quarter in the Slot." },
    { id: "love", plate: "How One Kills for Love" },
    { id: "laughter", plate: "Laughing Tears. Cabinet of Humour." },
];
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
// as in layout.ts: DOOR_S, CAMERA.from, CAMERA.to
const DOOR_S = [0.2, 0.333, 0.466, 0.6, 0.733, 0.866];
const FROM = -0.06;
const TO = 0.93;
const ATS = [0, ...DOOR_S.map((s) => walkAt(s, FROM, TO)), 1];

type Stage = "walk" | "door" | "dark" | "inside";
interface Sim {
    progress: number;
    stage: Stage;
    door: number;
    opened: string[];
    camera: boolean;
    asking: false | "live" | MirrorAskState;
    shut: boolean;
    hint: boolean;
    peek: number | null;
    about: boolean;
}
const BASE: Sim = { progress: 0, stage: "walk", door: 0, opened: [], camera: false, asking: false, shut: false, hint: false, peek: null, about: false };

export const SCENARIOS: Record<string, { label: string; sim: Partial<Sim> }> = {
    start: { label: "Start (first visit)", sim: { progress: 0, hint: true } },
    "start-again": { label: "Start (been before)", sim: { progress: 0, opened: ["taming", "hunt"] } },
    about: { label: "The programme (what is this place?)", sim: { progress: 0, about: true } },
    walking: { label: "Between doors", sim: { progress: 0.33, opened: ["taming"] } },
    door: { label: "At door I", sim: { progress: ATS[1] } },
    clash: { label: "At door II, first visit, mirror asked (one card wins)", sim: { progress: ATS[2], hint: true, asking: { phase: "ask" } } },
    "door-again": { label: "At door II, been in (long title)", sim: { progress: ATS[2], opened: ["taming", "personality"] } },
    peek: { label: "Rail: a stop's title (hover/long-press)", sim: { progress: 0.5, opened: ["taming", "personality"], peek: 4 } },
    opening: { label: "Door opening", sim: { progress: ATS[1], stage: "door", door: 0, opened: ["taming"] } },
    shut: { label: "A door that won't open", sim: { progress: ATS[3], door: 2, shut: true } },
    inside: { label: "Inside room I", sim: { progress: ATS[1], stage: "inside", door: 0, opened: ["taming"] } },
    "inside-long": { label: "Inside room II (long title)", sim: { progress: ATS[2], stage: "inside", door: 1, opened: ["taming", "personality"] } },
    "inside-last": { label: "Inside room VI (last)", sim: { progress: ATS[6], stage: "inside", door: 5, opened: DOORS.map((d) => d.id) } },
    mirror: { label: "At the mirror", sim: { progress: 1, opened: ["taming", "love"] } },
    "mirror-all": { label: "At the mirror, every room seen", sim: { progress: 1, opened: DOORS.map((d) => d.id) } },
    camera: { label: "Camera on", sim: { progress: 1, camera: true } },
    ask: { label: "Mirror: asking", sim: { progress: 1, asking: { phase: "ask" } } },
    waiting: { label: "Mirror: waiting for the camera", sim: { progress: 1, asking: { phase: "waiting" } } },
    "waiting-slow": { label: "Mirror: still waiting", sim: { progress: 1, asking: { phase: "waiting", slow: true } } },
    denied: { label: "Mirror: blocked for the site", sim: { progress: 1, asking: { phase: "failed", problem: "denied", detail: "NotAllowedError: Permission denied · camera permission: denied" } } },
    "denied-again": {
        label: "Mirror: still blocked (tried again)",
        sim: { progress: 1, asking: { phase: "failed", problem: "denied", tries: 2, detail: "NotAllowedError: Permission denied · camera permission: denied" } },
    },
    stale: { label: "Mirror: allowed, needs a reload", sim: { progress: 1, asking: { phase: "failed", problem: "stale", detail: "NotAllowedError: Permission denied · camera permission: granted" } } },
    system: { label: "Mirror: blocked by the OS", sim: { progress: 1, asking: { phase: "failed", problem: "system", detail: "NotAllowedError: Permission denied by system · camera permission: granted" } } },
    dismissed: { label: "Mirror: question closed", sim: { progress: 1, asking: { phase: "failed", problem: "dismissed" } } },
    notfound: { label: "Mirror: no camera", sim: { progress: 1, asking: { phase: "failed", problem: "notfound" } } },
    inuse: { label: "Mirror: camera busy", sim: { progress: 1, asking: { phase: "failed", problem: "inuse" } } },
    insecure: { label: "Mirror: plain http", sim: { progress: 1, asking: { phase: "failed", problem: "insecure" } } },
    unsupported: { label: "Mirror: in-app browser", sim: { progress: 1, asking: { phase: "failed", problem: "unsupported" } } },
    other: { label: "Mirror: other error", sim: { progress: 1, asking: { phase: "failed", problem: "other", detail: "InvalidStateError: The object is in an invalid state." } } },
    live: { label: "Mirror: for real (uses your camera)", sim: { progress: 1, asking: "live" } },
};

function useParams() {
    const [p, setP] = useState<URLSearchParams | null>(null);
    useEffect(() => setP(new URLSearchParams(window.location.search)), []);
    return p;
}

export function TheatreNavBench() {
    const params = useParams();
    if (!params) return <div className="fixed inset-0 z-[100] bg-[#070404]" />;
    return (
        <Bench
            scenario={params.get("s") ?? "start"}
            bare={params.get("bare") === "1"}
            touchParam={params.get("touch")}
            guides={params.get("guides") === "1"}
        />
    );
}

function Bench({ scenario, bare, touchParam, guides }: { scenario: string; bare: boolean; touchParam: string | null; guides: boolean }) {
    const initial = { ...BASE, ...(SCENARIOS[scenario]?.sim ?? {}) };
    const [sim, setSim] = useState<Sim>(initial);
    const progress = useMotionValue(initial.progress);
    const [touch, setTouch] = useState(touchParam === "1");
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [note, setNote] = useState("");
    const navShown = useNavVisible();
    const timers = useRef<number[]>([]);
    useEffect(() => {
        if (touchParam === null) setTouch(window.matchMedia("(pointer: coarse)").matches);
    }, [touchParam]);
    useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
    const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
    const patch = useCallback((p: Partial<Sim>) => setSim((s) => ({ ...s, ...p })), []);

    const near = useNearestStop(progress, ATS);
    const stops: RailStop[] = useMemo(
        () => [
            { key: "entrance", label: "Entrance", title: "Price of admission: your mind", kind: "entrance", at: ATS[0] },
            ...DOORS.map((d, i) => ({ key: d.id, label: ROMAN[i], title: d.plate, opened: sim.opened.includes(d.id), kind: "door" as const, at: ATS[i + 1] })),
            { key: "mirror", label: "Mirror", title: "The cracked mirror at the end", kind: "mirror", at: ATS[7] },
        ],
        [sim.opened],
    );

    // scrolling walks (as on the real page), only out in the corridor
    const now = useRef(sim);
    now.current = sim;
    useEffect(() => {
        const onWheel = (e: WheelEvent) => {
            if ((e.target as HTMLElement).closest?.("[data-bench-panel]")) return;
            if (now.current.stage === "walk" && !now.current.asking && !now.current.about) progress.set(Math.min(1, Math.max(0, progress.get() + e.deltaY / 3200)));
        };
        window.addEventListener("wheel", onWheel, { passive: true });
        return () => window.removeEventListener("wheel", onWheel);
    }, [progress]);

    // a stopped camera when it's put away
    useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

    const go = (i: number) => {
        patch({ hint: false, shut: false, peek: null });
        animate(progress, ATS[i], { duration: 1.1, ease: [0.4, 0, 0.2, 1] });
    };
    const doorAt = near !== null && near >= 1 && near <= 6 ? near - 1 : null;
    const acts = {
        walkIn: () => {
            patch({ hint: false });
            go(1);
        },
        about: () => patch({ about: true }),
        knock: () => {
            if (doorAt === null) return;
            const id = DOORS[doorAt].id;
            setSim((s) => ({ ...s, stage: "door", door: doorAt, opened: s.opened.includes(id) ? s.opened : [...s.opened, id], hint: false }));
            later(1300, () => {
                patch({ stage: "dark" });
                later(450, () => patch({ stage: "inside" }));
            });
        },
        back: () => {
            patch({ stage: "dark" });
            later(450, () => patch({ stage: "walk" }));
        },
        next: () => {
            const to = sim.door + 2;
            patch({ stage: "dark" });
            later(450, () => {
                patch({ stage: "walk" });
                go(Math.min(7, to));
            });
        },
        lookIn: () => patch({ asking: "live" }),
        lookAway: () => {
            setStream(null);
            patch({ camera: false });
        },
        leave: () => {
            setNote("(Leave the theatre: the page would go back now.)");
            later(2500, () => setNote(""));
        },
    };

    const door = (i: number) => ({ numeral: ROMAN[i], title: DOORS[i].plate, opened: sim.opened.includes(DOORS[i].id) });
    const at = near === 0 ? "entrance" : near === 7 ? "mirror" : doorAt;
    const moment = momentFor({
        stage: sim.stage,
        at,
        doors: DOORS.map((_, i) => door(i)),
        door: sim.stage === "walk" ? null : sim.door,
        asking: !!sim.asking,
        camera: sim.camera,
        shut: sim.shut ? sim.door : null,
        firstVisit: sim.hint,
    });
    const asking = at === "mirror" ? sim.asking : false; // the mirror only asks at the mirror
    const bar = barFor(moment, acts, touch);
    const railHidden = sim.stage === "inside" || sim.stage === "dark";
    const scene: "corridor" | "room" | "mirror" = sim.stage === "inside" ? "room" : near === 7 || sim.camera ? "mirror" : "corridor";

    return (
        <div className={`${fell.className} fixed inset-0 z-[100] overflow-hidden bg-[#070404]`}>
            <Painted scene={scene} door={doorAt ?? (sim.stage === "door" ? sim.door : null)} stream={stream} />
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-[450ms]" style={{ opacity: sim.stage === "dark" ? 1 : 0 }} />
            <GhostShell guides={guides} />

            <DoorRail stops={stops} current={near} progress={progress} onGo={go} hidden={railHidden || !navShown.visible} peek={sim.peek} onAbout={() => patch({ about: true })} fold={near === 0} />
            <ActionBar {...bar} hidden={(!navShown.visible && moment.kind !== "camera") || bar.hidden} />
            <NavToggle visible={navShown.visible} onToggle={navShown.toggle} />
            <AboutPanel open={sim.about} onClose={() => patch({ about: false })} />
            {asking === "live" ? (
                <MirrorAsk
                    open
                    touch={touch}
                    onStream={(s) => {
                        setStream(s);
                        patch({ asking: false, camera: true });
                    }}
                    onClose={() => patch({ asking: false })}
                />
            ) : (
                <MirrorAskView state={asking || null} touch={touch} onLook={() => patch({ asking: "live" })} onClose={() => patch({ asking: false })} />
            )}

            {note && <p className="fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded bg-black/80 px-3 py-1 text-[14px] text-[#eadccb]">{note}</p>}
            {!bare && <Panel scenario={scenario} sim={sim} progress={progress} touch={touch} setTouch={setTouch} />}
        </div>
    );
}

function Panel({
    scenario,
    sim,
    progress,
    touch,
    setTouch,
}: {
    scenario: string;
    sim: Sim;
    progress: MotionValue<number>;
    touch: boolean;
    setTouch: (t: boolean) => void;
}) {
    const [p, setP] = useState(progress.get());
    useEffect(() => progress.on("change", setP), [progress]);
    const goTo = (s: string) => {
        const q = new URLSearchParams(window.location.search);
        q.set("s", s);
        window.location.search = q.toString();
    };
    return (
        <details data-bench-panel className="fixed left-2 top-[72px] z-[60] max-w-[300px] rounded-md border border-white/15 bg-black/85 p-2 text-[13px] text-[#eadccb] [font-family:ui-sans-serif,system-ui]">
            <summary className="cursor-pointer select-none px-1 py-1 text-[#ffb36b]">Nav bench · {SCENARIOS[scenario]?.label ?? scenario}</summary>
            <div className="mt-2 flex flex-col gap-2 px-1">
                <label className="flex flex-col gap-1">
                    Scenario
                    <select value={scenario} onChange={(e) => goTo(e.target.value)} className="rounded bg-[#1b100c] px-1 py-1">
                        {Object.entries(SCENARIOS).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1">
                    Walk: {p.toFixed(3)} (stage {sim.stage})
                    <input type="range" min={0} max={1} step={0.001} value={p} onChange={(e) => progress.set(Number(e.target.value))} disabled={sim.stage !== "walk"} />
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={touch} onChange={(e) => setTouch(e.target.checked)} /> Touch wording
                </label>
                <button
                    type="button"
                    className="rounded border border-white/20 px-2 py-1 text-left"
                    onClick={() => {
                        try {
                            localStorage.removeItem("kg-theatre-hint");
                        } catch {}
                    }}
                >
                    Forget the first visit
                </button>
            </div>
        </details>
    );
}

// Where the site's own header and phone dock sit on the real page (drawn, not live).
function GhostShell({ guides }: { guides: boolean }) {
    return (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-40 [font-family:ui-sans-serif,system-ui]">
            <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-5 sm:px-8 md:px-0">
                <span className="h-7 w-7 rounded-full bg-[#7d8db0]" />
                <span className="text-[15px] font-medium text-[#eadccb]">Kartik Gautam</span>
                <span className="ml-auto hidden gap-6 text-[14px] text-[#a8957f] md:flex">
                    <span>Photos</span>
                    <span>Sky</span>
                    <span>Notes</span>
                    <span>Journey</span>
                    <span>Now</span>
                </span>
                <span className="ml-auto rounded-full bg-[#2a1d18] px-3 py-1.5 text-[13px] text-[#cdb79c] md:ml-4">Work · Life</span>
            </div>
            <div className="fixed inset-x-0 bottom-4 flex justify-center md:hidden">
                <div className="flex h-14 items-center gap-1 rounded-full border border-white/10 bg-[#1a1210]/85 px-2">
                    {Array.from({ length: 6 }, (_, i) => (
                        <span key={i} className="mx-2.5 h-[18px] w-[18px] rounded-[5px] border border-[#8a7766]" />
                    ))}
                </div>
            </div>
            {guides && (
                <>
                    <div className="fixed inset-x-0 top-[76px] border-t border-dashed border-cyan-300/70" />
                    <div className="fixed inset-x-0 bottom-[96px] border-t border-dashed border-cyan-300/70 md:hidden" />
                </>
            )}
        </div>
    );
}

// A painted stand-in for the 3D: busy, dark red, lamp-lit.
function Painted({ scene, door, stream }: { scene: "corridor" | "room" | "mirror"; door: number | null; stream: MediaStream | null }) {
    const video = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (video.current) video.current.srcObject = stream;
    }, [stream]);
    const damask = {
        background:
            "radial-gradient(ellipse 5px 8px at 50% 50%, rgba(150,42,26,0.75) 0 70%, transparent 75%) 0 0/26px 34px, radial-gradient(circle at 50% 0, rgba(120,32,20,0.6) 0 2px, transparent 3px) 13px 17px/26px 34px, repeating-linear-gradient(90deg, #3f0f0a 0 11px, #561a10 11px 13px, #350c08 13px 26px)",
    };
    return (
        <div aria-hidden className="absolute inset-0">
            {scene !== "room" ? (
                <>
                    <div className="absolute inset-0" style={{ ...damask, clipPath: "polygon(0 0, 44% 36%, 44% 60%, 0 100%)" }} />
                    <div className="absolute inset-0" style={{ ...damask, clipPath: "polygon(100% 0, 60% 36%, 60% 60%, 100% 100%)" }} />
                    <div className="absolute inset-0 bg-[#150906]" style={{ clipPath: "polygon(0 0, 100% 0, 60% 36%, 44% 36%)" }} />
                    <div
                        className="absolute inset-0"
                        style={{
                            background: "repeating-linear-gradient(90deg, #2a1209 0 18px, #1e0d07 18px 20px)",
                            clipPath: "polygon(0 100%, 44% 60%, 60% 60%, 100% 100%)",
                        }}
                    />
                    <div
                        className="absolute inset-0"
                        style={{
                            background: "linear-gradient(90deg, #4a0d08 0 6%, #8a1d12 6% 9%, #a3241a 9% 91%, #8a1d12 91% 94%, #4a0d08 94%)",
                            clipPath: "polygon(24% 100%, 49% 60%, 55% 60%, 80% 100%)",
                        }}
                    />
                    <div className="absolute bg-[#030101]" style={{ left: "44%", right: "40%", top: "36%", bottom: "40%" }} />
                    {[
                        [10, 38, 1],
                        [30, 44, 0.75],
                        [90, 38, 1],
                        [70, 44, 0.75],
                        [40, 47, 0.5],
                        [63, 47, 0.5],
                    ].map(([x, y, s]) => (
                        <div
                            key={`${x}-${y}`}
                            className="absolute rounded-full"
                            style={{
                                left: `${x}%`,
                                top: `${y}%`,
                                width: 380 * s,
                                height: 380 * s,
                                transform: "translate(-50%,-50%)",
                                background: "radial-gradient(circle, rgba(255,214,160,0.95) 0 3%, rgba(255,170,90,0.55) 8%, rgba(255,120,60,0.18) 30%, transparent 62%)",
                            }}
                        />
                    ))}
                    {door !== null && scene === "corridor" && (
                        <>
                            <div
                                className="absolute"
                                style={{
                                    left: "7%",
                                    top: "22%",
                                    width: "24%",
                                    height: "72%",
                                    background: "repeating-linear-gradient(90deg, #1a0d08 0 7px, #241109 7px 9px)",
                                    clipPath: "polygon(0 18%, 50% 0, 100% 10%, 100% 92%, 0 100%)",
                                    boxShadow: "0 0 40px rgba(255,120,50,0.6)",
                                }}
                            />
                            <div
                                className="absolute grid place-items-center border border-[#6b5432] bg-[#b98f52] text-[#3a2410]"
                                style={{ left: "33%", top: "42%", width: "6%", minWidth: 40, aspectRatio: "1.1" }}
                            >
                                <span className={`${fellSC.className} text-[14px]`}>{ROMAN[door]}</span>
                            </div>
                        </>
                    )}
                    {scene === "mirror" && (
                        <div
                            className="absolute left-1/2 top-[44%] overflow-hidden rounded-[50%] border-[10px] border-[#b48a45] shadow-[0_0_0_3px_#5a4020,0_0_60px_rgba(255,170,90,0.4)]"
                            style={{ width: "min(44vw, 34vh)", height: "min(62vw, 48vh)", transform: "translate(-50%,-50%)", background: "radial-gradient(ellipse at 40% 30%, #4a3a33, #1a1210 70%)" }}
                        >
                            {stream && <video ref={video} autoPlay muted playsInline className="h-full w-full scale-x-[-1] object-cover opacity-80 [filter:sepia(0.5)_contrast(1.1)]" />}
                            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <path d="M30 10 L45 40 L38 55 L52 90 M45 40 L70 35" stroke="rgba(255,230,200,0.5)" strokeWidth="0.6" fill="none" />
                            </svg>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,#3a160e,#120806_65%)]" />
                    <div
                        className="absolute left-1/2 top-[14%] h-[66%] w-[min(70vw,380px)] -translate-x-1/2 rounded-t-[40%_14%] border border-[#5a4a3c] bg-[#4a4038] shadow-[0_0_80px_rgba(255,150,80,0.35)]"
                        style={{ backgroundImage: "repeating-linear-gradient(180deg, transparent 0 22px, rgba(20,12,8,0.75) 22px 25px)", backgroundPosition: "0 60px" }}
                    />
                    {[30, 42, 58, 70].map((x) => (
                        <div
                            key={x}
                            className="absolute rounded-full"
                            style={{
                                left: `${x}%`,
                                top: "82%",
                                width: 160,
                                height: 160,
                                transform: "translate(-50%,-50%)",
                                background: "radial-gradient(circle, rgba(255,226,170,1) 0 4%, rgba(255,170,90,0.6) 10%, transparent 60%)",
                            }}
                        />
                    ))}
                </>
            )}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,transparent_40%,rgba(0,0,0,0.65)_100%)]" />
        </div>
    );
}
