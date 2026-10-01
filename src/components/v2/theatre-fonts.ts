import { IM_Fell_English, IM_Fell_English_SC } from "next/font/google";

// Old, slightly uneven printing type for the Magic Theatre and its sign.
export const fell = IM_Fell_English({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap" });
export const fellSC = IM_Fell_English_SC({ subsets: ["latin"], weight: "400", display: "swap" });
