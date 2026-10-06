'use client';

import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Neon } from "@/components/v2/theatre-sign";
import { fellSC } from "@/components/v2/theatre-fonts";
import { THEATRE_PATH } from "@/components/v2/theatre-host";
import { AboutPanel } from "@/components/v2/theatre3d/theatre-nav-about";
import { LitButton, PlainButton, Playbill, ink } from "@/components/v2/theatre3d/theatre-nav-ui";
import { theatre } from "@/data/v2/theatre";

// Where the 3D theatre can't be built (no WebGL, or it failed): the sign, and a
// playbill saying where it can be seen, with the link to take there and the
// programme to read meanwhile. (The hand-drawn 2D corridor that used to stand
// in here, magic-theatre.tsx, is put away for now.)

export function TheatreUnsupported() {
    const [about, setAbout] = useState(false);
    const [touch, setTouch] = useState(true);
    const [link, setLink] = useState(THEATRE_PATH);
    const [copied, setCopied] = useState(false);
    const timer = useRef(0);
    const printed = useRef<HTMLParagraphElement>(null);
    useEffect(() => {
        setTouch(window.matchMedia("(pointer: coarse)").matches);
        setLink(`${window.location.host}${THEATRE_PATH}`);
        return () => window.clearTimeout(timer.current);
    }, []);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}${THEATRE_PATH}`);
            setCopied(true);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setCopied(false), 2400);
        } catch {
            // not allowed: select the link printed on the card, to copy by hand
            if (printed.current) window.getSelection()?.selectAllChildren(printed.current);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[5] flex flex-col overflow-y-auto bg-[#050303] px-4 pb-[112px] pt-[88px] md:pb-12">
                <div className="m-auto flex w-full flex-col items-center gap-10">
                    <Neon text={theatre.sign.toUpperCase()} dead={10} className={`${fellSC.className} text-[20px] tracking-[0.4em] opacity-70`} />
                    <Playbill className="w-full max-w-[440px] px-5 pb-5 pt-4 text-center md:px-7">
                        <p className={ink.eyebrow}>Not on this screen</p>
                        <h1 className={`${ink.title} mt-1.5`}>The theatre is built in 3D, and it can&apos;t be drawn here.</h1>
                        <p className={`${ink.hint} mt-3`}>
                            {touch
                                ? "Open it on a laptop or desktop, and the doors will be waiting."
                                : "Try an up-to-date Chrome, Firefox, Safari or Edge with hardware acceleration on, and the doors will be waiting."}
                        </p>
                        <p ref={printed} className={`${fellSC.className} mt-4 select-all break-all text-[15px] tracking-[0.08em] text-[#d9c2a6]`}>{link}</p>
                        <div className="mt-5 flex flex-col gap-2.5">
                            <LitButton icon={copied ? <Check strokeWidth={1.6} /> : <Link2 strokeWidth={1.6} />} onClick={copy}>
                                {copied ? "Copied" : "Copy the link"}
                            </LitButton>
                            <PlainButton onClick={() => setAbout(true)}>What is this place?</PlainButton>
                        </div>
                        <p className="sr-only" aria-live="polite">
                            {copied ? "The link is copied." : ""}
                        </p>
                    </Playbill>
                </div>
            </div>
            {/* (outside the card's layer, so it opens over the site's header and dock) */}
            <AboutPanel open={about} onClose={() => setAbout(false)} />
        </>
    );
}
