'use client';

import { useCallback, useEffect, useState } from "react";

// Whether this is the visitor's first time in the theatre, remembered on their
// device once they've set off (Walk in, the map, or walking past the first door).
// The first time, the start card says how to walk. (There was a separate note
// beside the map; it covered the sign, so its tips moved into the start card.)

const KEY = "kg-theatre-hint";

/** Whether to show the how-to: true until it's been dismissed once on this device. */
export function useFirstVisit(key = KEY) {
    const [show, setShow] = useState(false);
    useEffect(() => {
        try {
            setShow(window.localStorage.getItem(key) !== "seen");
        } catch {
            setShow(true);
        }
    }, [key]);
    const dismiss = useCallback(() => {
        setShow(false);
        try {
            window.localStorage.setItem(key, "seen");
        } catch {}
    }, [key]);
    const reopen = useCallback(() => setShow(true), []);
    return { show, dismiss, reopen };
}
