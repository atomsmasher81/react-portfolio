import { Briefcase, Camera, Clock, House, NotebookPen, PenLine, Route, Telescope, type LucideIcon } from "lucide-react";
import type { Lens } from "@/data/v2/profile";

export interface NavItem {
    href: string;
    label: string;
    icon: LucideIcon;
    blurb: string;
    dock?: false; // left out of the phone dock (still in the desktop nav and search)
}

const home: NavItem = { href: "/", label: "Home", icon: House, blurb: "Start here" };

// Each side of the site has its own small nav, so neither ever runs out of room.
export const lensNav: Record<Lens, NavItem[]> = {
    work: [
        home,
        { href: "/projects", label: "Projects", icon: Briefcase, blurb: "Everything I've built" },
        { href: "/blogs", label: "Blogs", icon: PenLine, blurb: "Longer technical posts" },
    ],
    life: [
        home,
        { href: "/photos", label: "Photos", icon: Camera, blurb: "Things I stopped to look at" },
        { href: "/sky", label: "Sky", icon: Telescope, blurb: "A pulsar, the moon, the frontier" },
        { href: "/notes", label: "Notes", icon: NotebookPen, blurb: "Unfinished thoughts" },
        { href: "/journey", label: "Journey", icon: Route, blurb: "How I got here" },
        { href: "/now", label: "Now", icon: Clock, blurb: "What I'm up to these days", dock: false },
    ],
};

// Pages that belong to one side switch the site to that side when you land on them.
export function pageLens(pathname: string): Lens | null {
    for (const lens of ["work", "life"] as const) {
        if (lensNav[lens].some((n) => n.href !== "/" && isActive(pathname, n.href))) return lens;
    }
    return null;
}

export const isActive = (pathname: string, href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

export interface SearchItem {
    id: string;
    label: string;
    group: "Pages" | "Notes" | "Blogs" | "Projects" | "Links" | "Actions";
    hint?: string;
    href?: string;
    external?: boolean;
    action?: "lens-work" | "lens-life" | "copy-email";
}
