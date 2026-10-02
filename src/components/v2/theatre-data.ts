'use client';

import { useEffect, useState } from "react";
import type { Door, DoorPlate } from "@/data/v2/theatre";

// The theatre's content comes from the server one piece at a time: first the
// plaques, then a room only when its door is opened.

export function usePlates() {
    const [plates, setPlates] = useState<DoorPlate[] | null>(null);
    const [mirror, setMirror] = useState(false);
    const [words, setWords] = useState<string[]>([]);
    useEffect(() => {
        let alive = true;
        fetch("/api/theatre")
            .then((r) => r.json())
            .then((d: { doors?: DoorPlate[]; mirror?: boolean; words?: string[] }) => {
                if (!alive) return;
                setPlates(d.doors ?? []);
                setMirror(Boolean(d.mirror));
                setWords(d.words ?? []);
            })
            .catch(() => alive && setPlates([]));
        return () => {
            alive = false;
        };
    }, []);
    return { plates, mirror, words };
}

const rooms = new Map<string, Promise<Door | null>>();

/** A room, fetched once per visit. Start this when the door starts opening so it's ready when it's open. */
export function fetchRoom(id: string) {
    let room = rooms.get(id);
    if (!room) {
        room = fetch(`/api/theatre/${encodeURIComponent(id)}`)
            .then((r) => (r.ok ? (r.json() as Promise<Door>) : null))
            .catch(() => null);
        rooms.set(id, room);
    }
    return room;
}

const STORE = "kg-theatre";

/** Which doors this visitor has opened before, remembered on their device. */
export function useOpened() {
    const [opened, setOpened] = useState<string[]>([]);
    useEffect(() => {
        try {
            setOpened(JSON.parse(localStorage.getItem(STORE) ?? "[]"));
        } catch {}
    }, []);
    const mark = (id: string) =>
        setOpened((xs) => {
            if (xs.includes(id)) return xs;
            const next = [...xs, id];
            try {
                localStorage.setItem(STORE, JSON.stringify(next));
            } catch {}
            return next;
        });
    return [opened, mark] as const;
}
