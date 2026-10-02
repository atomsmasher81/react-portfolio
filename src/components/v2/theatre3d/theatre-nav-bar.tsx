'use client';

import { useEffect, useRef, type MutableRefObject, type ReactNode } from "react";
import { AnimatePresence, motion, useIsomorphicLayoutEffect, useReducedMotion } from "framer-motion";
import { LitButton, PlainButton, PlainIcon, Playbill, focusRing, ink, plainClass, useTheatreDialogOpen } from "@/components/v2/theatre3d/theatre-nav-ui";

// The one thing to do next, at the foot of the screen, on a playbill card:
// a caption (where you are) and one big lit button, sometimes a second, plain
// one, and a short hint. On a phone it stacks, clear of the site's dock; on a
// wider screen it's a strip, caption on the left, buttons on the right (the
// buttons drop to a second row if they don't fit beside the caption).
// When what you can do changes, the old card fades down and the new one rises.
// It's one slot: one card at a time, and none while a theatre dialog is open.
// At the start it's a single low row (compact), off to the right on a wide
// screen, so the sign, the box office and its playbill stay in view.
//
// The card's height (plus a gap) is published as the CSS variable
// --theatre-bar on <html>, so the rail (and the page, framing a shrine) can
// keep clear of it.

export interface BarAction {
    label: string;
    icon?: ReactNode;
    /** Drawn after the label (e.g. an arrow on "Next door"). */
    trailing?: ReactNode;
    onClick(): void;
    /** A fuller name for screen readers, if the label alone is ambiguous. */
    ariaLabel?: string;
    /** Take keyboard focus when this card appears (e.g. "Back to the corridor" on entering a room). */
    autoFocus?: boolean;
}

/** A link that sits with the buttons (e.g. "Write to me", a mailto in a letter room). */
export interface BarLink {
    label: string;
    href: string;
    icon?: ReactNode;
}

export interface ActionBarProps {
    caption?: { eyebrow?: string; title: string };
    primary?: BarAction;
    secondary?: BarAction;
    link?: BarLink;
    hint?: string;
    hidden?: boolean;
    /**
     * One low row: the lit button, the second action as a quiet text link, and the hint under
     * them (no caption). For the opening view, where the place itself has to be seen.
     */
    compact?: boolean;
    /** On a wide screen, sit at the right (left of the rail) rather than in the middle. */
    align?: "center" | "end";
    /** Changing this swaps the card with a fade; by default it's derived from the caption and the buttons' labels. */
    contextKey?: string;
}

export function ActionBar({ caption, primary, secondary, link, hint, hidden = false, compact = false, align = "center", contextKey }: ActionBarProps) {
    const reduced = useReducedMotion();
    const holder = useRef<HTMLDivElement>(null);
    const keepFocus = useRef(false);
    const dialog = useTheatreDialogOpen(); // a dialog has the foot of the screen to itself
    const empty = !caption && !primary && !secondary && !link && !hint;
    const show = !hidden && !empty && !dialog;
    const k = !show ? "hidden" : contextKey ?? [caption?.eyebrow, caption?.title, primary?.label, secondary?.label, link?.href, hint].join("|");

    // If focus was on the card that's going, the next card to arrive takes it (its main
    // button), as long as it hasn't gone somewhere else in the meantime.
    useIsomorphicLayoutEffect(() => {
        if (holder.current?.contains(document.activeElement)) keepFocus.current = true;
    }, [k]);

    // Tell everyone else how much of the bottom of the screen this takes.
    useEffect(() => {
        const el = holder.current;
        const root = document.documentElement;
        if (!el) return;
        const set = () => root.style.setProperty("--theatre-bar", `${el.offsetHeight > 0 ? el.offsetHeight + 12 : 0}px`);
        set();
        const ro = new ResizeObserver(set);
        ro.observe(el);
        return () => {
            ro.disconnect();
            root.style.removeProperty("--theatre-bar");
        };
    }, []);

    const announce = caption ? [caption.eyebrow, caption.title].filter(Boolean).join(". ") : "";

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-[96px] z-30 flex justify-center px-4 md:bottom-8">
            <p className="sr-only" aria-live="polite">
                {show ? announce : ""}
            </p>
            <div ref={holder} className="flex w-full justify-center">
                <AnimatePresence mode="wait" initial={false}>
                    {show && (
                        <motion.section
                            key={k}
                            data-theatre-bar
                            aria-label={caption?.title ?? primary?.label ?? "The theatre"}
                            className={`pointer-events-auto w-full max-w-[440px] md:w-auto md:max-w-[min(960px,calc(100vw_-_160px))] ${align === "end" ? "md:ml-auto md:mr-[72px]" : ""}`}
                            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
                            animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0.15 : 0.34, ease: [0.2, 0.7, 0.2, 1] } }}
                            exit={{ opacity: 0, y: reduced ? 0 : 6, transition: { duration: reduced ? 0.1 : 0.18, ease: "easeIn" } }}
                        >
                            {compact ? (
                                <Row primary={primary} secondary={secondary} hint={hint} focus={keepFocus} />
                            ) : (
                                <Card caption={caption} primary={primary} secondary={secondary} link={link} hint={hint} focus={keepFocus} />
                            )}
                        </motion.section>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// The compact card: one row, kept low, so the view above it stays clear.
function Row({ primary, secondary, hint, focus }: Pick<ActionBarProps, "primary" | "secondary" | "hint"> & { focus: MutableRefObject<boolean> }) {
    const main = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const lost = !document.activeElement || document.activeElement === document.body;
        if ((focus.current && lost) || primary?.autoFocus) main.current?.focus({ preventScroll: true });
        if (main.current) focus.current = false;
        // only when this card arrives
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <Playbill className="px-3 py-3 md:px-4">
            {/* a phone: one row across the foot; a wide screen: one row at the right; in between
                (a tablet, a phone on its side, a small laptop) a narrow stack, so it stays right of the playbill */}
            <div className="flex items-center gap-2 md:max-[1099px]:flex-col md:max-[1099px]:items-stretch md:max-[1099px]:gap-1">
                {primary && (
                    <LitButton ref={main} icon={primary.icon} onClick={primary.onClick} aria-label={primary.ariaLabel} className="shrink-0">
                        {primary.label}
                    </LitButton>
                )}
                {secondary && (
                    <button
                        type="button"
                        onClick={secondary.onClick}
                        aria-label={secondary.ariaLabel}
                        className={`${ink.hint} min-h-[44px] flex-1 rounded-[6px] px-3 text-center text-[#f1d9bd] underline decoration-[#8f7142] underline-offset-4 transition-colors hover:text-[#fff1de] hover:decoration-[#c09a5f] md:flex-none ${focusRing}`}
                    >
                        {secondary.label}
                    </button>
                )}
            </div>
            {/* the line on how to walk: only where there's room for it beside the place (on a phone the row stays one low row) */}
            {hint && <p className={`${ink.hint} mt-2 hidden px-1 min-[1100px]:block`}>{hint}</p>}
        </Playbill>
    );
}

function Card({
    caption,
    primary,
    secondary,
    link,
    hint,
    focus,
}: Pick<ActionBarProps, "caption" | "primary" | "secondary" | "link" | "hint"> & { focus: MutableRefObject<boolean> }) {
    const main = useRef<HTMLButtonElement>(null);
    const other = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const lost = !document.activeElement || document.activeElement === document.body;
        if ((focus.current && lost) || primary?.autoFocus) (main.current ?? other.current)?.focus({ preventScroll: true });
        if (main.current || other.current) focus.current = false;
        // only when this card arrives
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const buttons = !!(primary || secondary || link);
    // Where the hint goes. With a caption, on a wide screen: under it. On a phone, with two
    // buttons: beside the second. Otherwise: on a line of its own after the buttons.
    const beside = !!(hint && primary && (secondary || link));
    const lineOnPhone = buttons && !beside;
    const lineOnDesk = buttons && !caption;
    return (
        <Playbill className="px-4 pb-4 pt-3.5 md:flex md:flex-wrap md:items-center md:gap-x-7 md:gap-y-3 md:px-6 md:py-4">
            {caption && (
                <div className={`min-w-0 md:min-w-[220px] md:max-w-[340px] md:flex-[1_1_auto] ${buttons ? "" : "text-center md:max-w-[460px]"} ${!buttons && !hint ? "py-1" : ""}`}>
                    {caption.eyebrow && <p className={ink.eyebrow}>{caption.eyebrow}</p>}
                    <p className={`${ink.title} ${caption.eyebrow ? "mt-1" : ""}`}>{caption.title}</p>
                    {hint && <p className={`${ink.hint} mt-1.5 ${buttons ? "hidden md:block" : ""}`}>{hint}</p>}
                </div>
            )}
            {buttons && (
                <div className={`flex flex-col gap-2.5 md:flex-[0_0_auto] md:flex-row md:items-center ${caption ? "mt-3.5 md:mt-0" : ""}`}>
                    {primary && (
                        <LitButton ref={main} icon={primary.icon} trailing={primary.trailing} onClick={primary.onClick} aria-label={primary.ariaLabel} className="w-full md:w-auto">
                            {primary.label}
                        </LitButton>
                    )}
                    {(secondary || link) && (
                        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 md:contents">
                            {secondary && (
                                <PlainButton
                                    ref={other}
                                    icon={secondary.icon}
                                    trailing={secondary.trailing}
                                    onClick={secondary.onClick}
                                    aria-label={secondary.ariaLabel}
                                    className={beside ? "shrink-0" : "w-full md:w-auto"}
                                >
                                    {secondary.label}
                                </PlainButton>
                            )}
                            {link && (
                                <a href={link.href} className={`${plainClass} ${beside ? "shrink-0" : "w-full md:w-auto"}`}>
                                    {link.icon && <PlainIcon>{link.icon}</PlainIcon>}
                                    <span className="pt-[2px]">{link.label}</span>
                                </a>
                            )}
                            {beside && <p className={`${ink.hint} min-w-0 md:hidden`}>{hint}</p>}
                        </div>
                    )}
                </div>
            )}
            {hint && !caption && !buttons && <p className={`${ink.hint} text-center`}>{hint}</p>}
            {hint && (lineOnPhone || lineOnDesk) && (
                <p className={`${ink.hint} mt-2.5 text-center md:mt-0 md:text-left ${lineOnPhone ? "" : "hidden"} ${lineOnDesk ? "md:block" : "md:hidden"}`}>{hint}</p>
            )}
        </Playbill>
    );
}
