'use client';

import { useEffect } from "react";
import { profile } from "@/data/v2/profile";

// A note for whoever opens devtools. Printed once per visit.
const CAT = String.raw`
         ✦
        /\
       /  \    .
      /____\
      /\_/\
     ( o.o )
      > ^ <___/✦
     /       \
    (_________)
`;

export function ConsoleHello() {
    useEffect(() => {
        const w = window as Window & { __kgHello?: boolean };
        if (w.__kgHello) return;
        w.__kgHello = true;
        console.log(`%c${CAT}`, "font-family: ui-monospace, monospace; color: #8b7cf6; line-height: 1.25");
        console.log("%cYou opened devtools. You're my kind of person.", "font: 600 14px/1.5 ui-sans-serif, system-ui, sans-serif");
        console.log(
            `%cSay hi: ${profile.email}\nThe code: https://github.com/atomsmasher81/react-portfolio\n\nOne more thing. There's a theatre somewhere on this site. It only opens at night.`,
            "font: 13px/1.6 ui-sans-serif, system-ui, sans-serif; color: #8a8a8a",
        );
    }, []);
    return null;
}
