'use client';

import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { MoonDisc, useMoon } from "@/components/v2/moon";
import { fell, fellSC } from "@/components/v2/theatre-fonts";
import type { RoomImage, Room as RoomData } from "@/data/v2/theatre";

// What's behind a door, shown over the theatre (2D or 3D) like a page lit by
// a candle. `room` is null while it's still on its way from the server.

const NEON = "#ff8f66";

export function RoomView({ plate, room, missing = false, onClose }: { plate: string; room: RoomData | null; missing?: boolean; onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
        >
            <div className="absolute inset-0 bg-[#040202]/85 backdrop-blur-[3px]" onClick={onClose} />
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={plate}
                className="relative my-auto w-full max-w-lg overflow-hidden rounded-[6px] bg-[#150e0b] p-7 text-left shadow-[0_0_120px_-20px_rgba(255,110,60,0.35),inset_0_0_60px_rgba(0,0,0,0.8)] sm:p-10"
                initial={{ scale: 0.94, y: 18, filter: "brightness(2) blur(4px)" }}
                animate={{ scale: 1, y: 0, filter: "brightness(1) blur(0px)" }}
                exit={{ scale: 0.97, y: 10, opacity: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
                <span className="v2-grain pointer-events-none absolute -inset-[50%] opacity-[0.06] mix-blend-overlay" />
                {/* a candle somewhere below */}
                <span
                    className="v2-lamp pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
                    style={{ background: "radial-gradient(ellipse 60% 70% at 50% 110%, rgba(255,140,70,0.16), transparent 70%)", animationDuration: "7s" }}
                />
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Back to the corridor"
                    className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[#eadccb]/50 transition-colors hover:bg-white/5 hover:text-[#eadccb]"
                >
                    <X className="h-4 w-4" />
                </button>
                <p className={`${fellSC.className} relative text-[14px] tracking-[0.22em]`} style={{ color: NEON, textShadow: "0 0 12px rgba(255,90,50,0.5)" }}>
                    {plate}
                </p>
                <div className="relative mt-6 space-y-4 font-serif text-[17px] leading-relaxed text-[#eadccb]/85">
                    {room ? (
                        <>
                            <Room room={room} />
                            {room.images?.map((img) => <Picture key={img.src} image={img} />)}
                        </>
                    ) : (
                        <p className="italic text-[#eadccb]/50">{missing ? "This door won't open tonight." : "…"}</p>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

function Paragraphs({ body }: { body: string[] }) {
    return (
        <>
            {body.map((p) => (
                <p key={p}>{p}</p>
            ))}
        </>
    );
}

function Picture({ image }: { image: RoomImage }) {
    return (
        <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} alt="" className="w-full rounded-[3px] [filter:sepia(0.25)_contrast(1.05)]" />
            {image.caption && <figcaption className={`${fell.className} mt-4 whitespace-pre-line italic text-[#eadccb]/80`}>{image.caption}</figcaption>}
            {image.date && <p className="mt-2 text-xs text-[#eadccb]/40">{new Date(image.date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>}
        </figure>
    );
}

function Room({ room }: { room: RoomData }) {
    const phase = useMoon();
    switch (room.kind) {
        case "text":
            return <Paragraphs body={room.body} />;
        case "moon":
            return (
                <>
                    <div className="flex items-center gap-5 pb-2">
                        <MoonDisc phase={phase} size={84} />
                        {phase && (
                            <p className="text-sm text-[#eadccb]/55">
                                Tonight it&apos;s a {phase.name.toLowerCase()},
                                <br />
                                {Math.round(phase.illumination * 100)}% lit.
                            </p>
                        )}
                    </div>
                    <Paragraphs body={room.body} />
                </>
            );
        case "photo":
            return (
                <>
                    <Picture image={room} />
                    {room.body && <Paragraphs body={room.body} />}
                </>
            );
        case "quote":
            return (
                <>
                    <Paragraphs body={room.body} />
                    <blockquote className={`${fell.className} border-l-2 pl-4 text-[20px] italic`} style={{ borderColor: NEON }}>
                        {room.quote}
                        <span className="mt-2 block font-sans text-xs not-italic text-[#eadccb]/45">{room.by}</span>
                    </blockquote>
                </>
            );
        case "letter":
            return (
                <>
                    <Paragraphs body={room.body} />
                    <a
                        href={`mailto:${room.email}?subject=${encodeURIComponent(room.subject)}`}
                        className={`${fellSC.className} mt-3 inline-flex items-center gap-2 rounded-[3px] border border-[#ff8f66]/50 px-5 py-2.5 text-[15px] tracking-[0.2em] transition-colors hover:bg-[#ff8f66]/10`}
                        style={{ color: NEON }}
                    >
                        Write to me
                    </a>
                </>
            );
    }
}
