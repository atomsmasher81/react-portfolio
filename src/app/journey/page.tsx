import { ReadingProgress } from "@/components/v2/reading-progress";
import { JourneyStory } from "@/components/v2/journey-story";
import { ReadThisFar } from "@/components/v2/read-this-far";
import { journey } from "@/data/v2/journey";

export const metadata = { title: "The journey", description: "The longer version, from Muzaffarnagar to now." };

export default function JourneyPage() {
    return (
        <div className="mx-auto max-w-2xl">
            <ReadingProgress />
            <header className="pb-12 pt-14 sm:pt-24">
                <h1 className="v2-display text-[2.75rem] sm:text-[3.25rem]">The journey</h1>
                <p className="mt-4 text-[17px] leading-relaxed text-[var(--muted)]">Not a resume. The longer version, from the beginning.</p>
            </header>
            <JourneyStory eras={journey.eras} />
            <div className="mt-20">
                <ReadThisFar />
            </div>
        </div>
    );
}
