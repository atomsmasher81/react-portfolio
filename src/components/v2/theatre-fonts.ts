import { IM_Fell_English, IM_Fell_English_SC } from "next/font/google";

// Old, slightly uneven printing type for the Magic Theatre and its sign.
// Not preloaded: the theatre is loaded (lazily) from the root layout, and Turbopack
// preloads every font that layout can reach on every page, so all of them would
// fetch these. What the theatre paints waits for its type itself (chamber-layout.ts).
export const fell = IM_Fell_English({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap", preload: false });
export const fellSC = IM_Fell_English_SC({ subsets: ["latin"], weight: "400", display: "swap", preload: false });
