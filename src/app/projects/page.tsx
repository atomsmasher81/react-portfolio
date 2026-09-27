import { ProjectCard } from "@/components/v2/project-card";
import { Reveal, SectionTitle } from "@/components/v2/motion";
import { projects } from "@/data/projects";

export const metadata = { title: "Projects", description: "Everything Kartik Gautam has built or helped build since 2019." };

export default function WorkPage() {
    const featured = projects.filter((p) => p.highlight);
    const rest = projects.filter((p) => !p.highlight);

    return (
        <div className="mx-auto max-w-2xl">
            <header className="pb-12 pt-14 sm:pt-24">
                <h1 className="v2-display text-[2.75rem] sm:text-[3.25rem]">Projects</h1>
                <p className="mt-4 text-[17px] leading-relaxed text-[var(--muted)]">
                    {projects.length} things I&apos;ve built or helped build since 2019. A few are my own products, most were for founders who
                    needed them shipped. Click any card for the stack and links.
                </p>
            </header>

            <section className="mb-16" aria-labelledby="featured">
                <SectionTitle id="featured">Featured</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                    {featured.map((p, i) => (
                        <Reveal key={`${p.title}-${i}`} delay={(i % 2) * 0.06} className="h-full min-w-0">
                            <ProjectCard project={p} id={`f-${i}`} />
                        </Reveal>
                    ))}
                </div>
            </section>

            <section aria-labelledby="more">
                <SectionTitle id="more">Everything else, newest first</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                    {rest.map((p, i) => (
                        <Reveal key={`${p.title}-${i}`} delay={(i % 2) * 0.06} className="h-full min-w-0">
                            <ProjectCard project={p} id={`r-${i}`} />
                        </Reveal>
                    ))}
                </div>
            </section>
        </div>
    );
}
