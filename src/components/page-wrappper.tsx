'use client';
import React from "react";

import {AnimatePresence, motion} from "framer-motion";

export const PageWrapper = (
    {children}: { children: React.ReactNode}
) => {
    return (
        <motion.div
        initial={{opacity: 0,y: 20 }}
                animate={{opacity: 1,y: 0 }}
                exit={{opacity: 0,y: 20 }}
        >
            <div className="max-w-4xl mx-auto p-4 pt-0 sm:p-8">
                {children}
            </div>
        </motion.div>
    )
}