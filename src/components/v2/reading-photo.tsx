'use client';

import { motion } from "framer-motion";

// The current book as a small print pinned beside the text. It settles in
// with a slight tilt; hovering straightens and lifts it.
export function ReadingPhoto({ image, title, author, caption }: { image: string; title: string; author: string; caption: string }) {
    return (
        <motion.figure
            className="w-[58%] max-w-[190px] sm:w-full"
            initial={{ opacity: 0, y: 24, rotate: 0 }}
            whileInView={{ opacity: 1, y: 0, rotate: 3 }}
            whileHover={{ rotate: 0, y: -6, scale: 1.03 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ type: "spring", stiffness: 180, damping: 18 }}
        >
            <div className="rounded-[3px] bg-white p-2 pb-7 shadow-[0_14px_36px_-14px_rgba(14,28,51,0.45)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={`${title} by ${author}`} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                <figcaption className="mt-2 text-center text-[11px] text-neutral-500">{caption}</figcaption>
            </div>
        </motion.figure>
    );
}
