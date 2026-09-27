'use client';

import { motion, useScroll, useSpring } from "framer-motion";

export function ReadingProgress() {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });
    return <motion.div style={{ scaleX }} className="fixed inset-x-0 top-16 z-40 h-0.5 origin-left bg-[var(--accent)]" />;
}
