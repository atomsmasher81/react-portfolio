'use client';

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Maximize2, Minimize2 } from "lucide-react";
import { fellSC } from "@/components/v2/theatre-fonts";
import { focusRing, useTheatreDialogOpen } from "@/components/v2/theatre3d/theatre-nav-ui";

// The way-finding can be put away, so the place has the screen to itself (on a
// phone the rail and the card at the foot take a good part of it). One small
// brass button, top left under the site's header, phone and wide screen alike,
// hides the rail and the card, and brings them back. Walking, knocking and
// leaving a room don't need them: scroll or swipe, tap the door, Esc or swipe
// up or the back button. What you chose is remembered on this device. The page
// keeps two cards regardless: the one while the theatre gets ready, and the
// camera's (there's always a way to look away).

const KEY = "kg-theatre-nav";

/** Whether the rail and the action bar are shown: true until hidden with NavToggle, remembered on this device. */
export function useNavVisible(key = KEY) {
    const [visible, setVisible] = useState(true);
    useEffect(() => {
        try {
            setVisible(window.localStorage.getItem(key) !== "hidden");
        } catch {}
    }, [key]);
    const toggle = useCallback(() => {
        const next = !visible;
        setVisible(next);
        try {
            if (next) window.localStorage.removeItem(key);
            else window.localStorage.setItem(key, "hidden");
        } catch {}
    }, [key, visible]);
    return { visible, toggle };
}

export interface NavToggleProps {
    /** The rail and the bar are showing. */
    visible: boolean;
    onToggle(): void;
    hidden?: boolean;
}

export function NavToggle({ visible, onToggle, hidden = false }: NavToggleProps) {
    const reduced = useReducedMotion();
    const dialog = useTheatreDialogOpen(); // a dialog has the screen
    const Icon = visible ? Maximize2 : Minimize2;
    return (
        <div className="pointer-events-none fixed left-2 top-[76px] z-30 md:left-4 md:top-[84px]">
            <AnimatePresence>
                {!hidden && !dialog && (
                    <motion.button
                        key="toggle"
                        type="button"
                        onClick={onToggle}
                        className={`group pointer-events-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full outline-none [touch-action:manipulation] ${focusRing}`}
                        initial={{ opacity: 0, x: reduced ? 0 : -14 }}
                        // quieter while it's all that's left, so it doesn't call to you over the place
                        animate={{ opacity: visible ? 1 : 0.7, x: 0 }}
                        whileHover={{ opacity: 1 }}
                        whileFocus={{ opacity: 1 }}
                        exit={{ opacity: 0, x: reduced ? 0 : -14 }}
                        transition={{ duration: reduced ? 0.15 : 0.4, ease: "easeOut" }}
                    >
                        <span className="flex h-[36px] items-center gap-2 rounded-full border border-[#8f7142]/70 bg-[#0e0807]/[0.9] px-[9px] text-[#d9c2a6] shadow-[0_10px_30px_rgba(0,0,0,0.6),inset_0_0_0_3px_rgba(14,8,7,0.9),inset_0_0_0_4px_rgba(160,124,72,0.22)] backdrop-blur-md transition-colors group-hover:border-[#c9a46a] group-hover:text-[#fff1de] md:pr-4">
                            <Icon aria-hidden strokeWidth={1.6} className="h-[16px] w-[16px] shrink-0" />
                            <span className={`${fellSC.className} sr-only pt-[2px] text-[14px] leading-none tracking-[0.12em] md:not-sr-only`}>{visible ? "Hide guides" : "Show guides"}</span>
                        </span>
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
