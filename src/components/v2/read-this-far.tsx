import { Reveal } from "@/components/v2/motion";
import { profile } from "@/data/v2/profile";

// A small easter egg for whoever makes it to the very bottom.
export function ReadThisFar() {
    return (
        <Reveal>
            <p className="pt-4 text-center text-sm text-[var(--muted)]">
                <span aria-hidden className="v2-twinkle mr-1.5 inline-block text-[var(--accent)]">
                    ✦
                </span>
                Read this far?{" "}
                <a href={`mailto:${profile.email}?subject=I%20read%20this%20far`} className="v2-link text-[var(--ink)]">
                    Tell me what you felt.
                </a>
            </p>
        </Reveal>
    );
}
