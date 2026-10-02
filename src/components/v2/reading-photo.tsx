'use client';

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { track } from "@/lib/analytics";

// The current book as a small print pinned beside the text. It settles in
// with a slight tilt; hovering straightens and lifts it, and tapping opens
// it up large.
export function ReadingPhoto({ image, title, author, caption }: { image: string; title: string; author: string; caption: string }) {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const alt = `${title} by ${author}`;

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = overflow;
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <>
            {/* settling in and the hover are CSS (v2-print in v2.css), so the print shows before the page's JS has run */}
            <figure className="v2-print w-[58%] max-w-[190px] sm:w-full">
                <button
                    type="button"
                    onClick={() => {
                        track("reading_photo_open", { label: alt });
                        setOpen(true);
                    }}
                    aria-label={`View ${alt} larger`}
                    className="block w-full cursor-zoom-in rounded-[3px] bg-white p-2 pb-7 text-left shadow-[0_14px_36px_-14px_rgba(14,28,51,0.45)]"
                >
                    <Image src={image} alt={alt} width={480} height={640} sizes="(min-width: 640px) 260px, 190px" priority className="aspect-[3/4] w-full object-cover" />
                    <figcaption className="mt-2 text-center text-[11px] text-neutral-500">{caption}</figcaption>
                </button>
            </figure>

            {/* Rendered on <body>: the tilted print's transform would otherwise trap a fixed overlay. */}
            {mounted &&
                createPortal(
                    <AnimatePresence>
                        {open && (
                            <motion.div
                                role="dialog"
                                aria-modal="true"
                                aria-label={alt}
                                className="fixed inset-0 z-[70] flex cursor-zoom-out flex-col items-center justify-center bg-[rgba(8,14,28,0.86)] p-5 backdrop-blur-sm"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                onClick={() => setOpen(false)}
                            >
                                <motion.figure
                                    className="flex max-h-full flex-col items-center"
                                    initial={{ scale: 0.92, rotate: 3, y: 12 }}
                                    animate={{ scale: 1, rotate: 0, y: 0 }}
                                    exit={{ scale: 0.95, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={image}
                                        alt={alt}
                                        className="max-h-[80vh] w-auto max-w-full rounded-[4px] object-contain shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
                                    />
                                    <figcaption className="mt-4 text-center text-sm text-white/70">
                                        {title} <span className="text-white/40">by {author}</span>
                                    </figcaption>
                                </motion.figure>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    aria-label="Close"
                                    className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body,
                )}
        </>
    );
}
