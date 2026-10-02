"use client";

import dynamic from "next/dynamic";

// The dev-only workbenches, loaded in the browser only. Since Next 15, `ssr: false`
// is only allowed in a client component, so the pages import them from here.
export const TheatreLab = dynamic(() => import("@/components/v2/theatre3d/lab").then((m) => m.TheatreLab), { ssr: false });
export const ChamberLab = dynamic(() => import("@/components/v2/theatre3d/chamber-lab").then((m) => m.ChamberLab), { ssr: false });
export const TheatreNavBench = dynamic(() => import("@/components/v2/theatre3d/theatre-nav-bench").then((m) => m.TheatreNavBench), { ssr: false });
