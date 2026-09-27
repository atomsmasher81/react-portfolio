'use client';

import { useLens } from "@/components/v2/lens";

// Work and life are two different compositions, not one page reshuffled.
// The swap itself is animated by the lens view transition.
export function HomeSwitch({ work, life }: { work: React.ReactNode; life: React.ReactNode }) {
    const { lens } = useLens();
    return <>{lens === "work" ? work : life}</>;
}
