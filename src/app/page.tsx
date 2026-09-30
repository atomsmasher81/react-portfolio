import { HomeSwitch } from "@/components/v2/home-switch";
import { WorkHome } from "@/components/v2/work-home";
import { LifeHome } from "@/components/v2/life-home";
import { projects } from "@/data/projects";
import { blogs } from "@/data/blogs";
import { testimonials } from "@/data/testimonials";
import { experience, workIntro } from "@/data/v2/work";
import { lifeIntro, profile } from "@/data/v2/profile";
import { now } from "@/data/v2/now";
import { notes } from "@/data/v2/notes";
import { photos, thumb } from "@/data/v2/photos";
import { journey } from "@/data/v2/journey";
import { JsonLd } from "@/components/JsonLd";
import { PERSON_ID, SITE_DESCRIPTION, SITE_URL, WEBSITE_ID, isoDate, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ description: SITE_DESCRIPTION, path: "/", type: "profile" });

// The strongest line from each testimonial, verbatim. The full quote opens on click.
const pullQuotes: Record<string, string> = {
    "Evan Burkosky": "Kartik Gautam is one of the most capable Tech Leads I’ve had the pleasure of working with.",
    "Aditi Mishra": "If you need someone who can turn messy ideas into real, working solutions, Kartik’s your guy.",
    Joe: "Out of the hundreds of developers I’ve worked with over the past 2 decades, only 4 of them have the engineering prowess, business mindset, and design sensibilities. Yes, Kartik is one of them.",
    Sarthak: "Last month, he helped me spot a Redis memory leak in 10 minutes that I'd been stuck on for days.",
};

const firstSentence = (text: string) => text.trim().replace(/\s+/g, " ").split(/(?<=[.!?])\s/)[0];

export default function V2Home() {
    const work = (
        <WorkHome
            intro={workIntro}
            roles={experience}
            projects={projects.filter((p) => p.highlight)}
            projectCount={projects.length}
            testimonials={testimonials.map((t) => ({
                name: t.name,
                role: t.role,
                avatar: t.avatar,
                excerpt: pullQuotes[t.name] ?? firstSentence(t.quote),
                quote: t.quote.trim().replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n\n"),
            }))}
            posts={[...blogs]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 4)
                .map(({ id, title, date }) => ({ id, title, date }))}
            email={profile.email}
            bookingUrl={profile.bookingUrl}
            socials={profile.socials}
        />
    );

    const picks = [...photos.filter((p) => p.pick), ...photos.filter((p) => !p.pick)];
    const life = (
        <LifeHome
            firstName={profile.firstName}
            timeZone={profile.timeZone}
            lines={lifeIntro.lines}
            interests={lifeIntro.interests}
            aside={lifeIntro.aside}
            photos={picks.slice(0, 5).map((p) => ({ id: p.id, src: thumb(p, 480), title: p.title, place: p.place }))}
            now={{ updated: now.updated, paragraphs: now.paragraphs, reading: now.reading, listening: now.listening }}
            journey={journey.summary}
            notes={notes.slice(0, 3).map((n) => ({ slug: n.slug, title: n.title, excerpt: n.excerpt }))}
        />
    );

    // The home page is Kartik's profile: Google shows ProfilePage results for
    // people, and it ties the Person (defined in the layout) to this URL.
    const profilePage = {
        "@type": "ProfilePage",
        "@id": `${SITE_URL}/#profile`,
        url: SITE_URL,
        name: "Kartik Gautam · Senior full-stack engineer",
        mainEntity: { "@id": PERSON_ID },
        isPartOf: { "@id": WEBSITE_ID },
        dateModified: isoDate([now.updated, ...notes.map((n) => n.date), ...blogs.map((b) => b.date)].sort().at(-1)!),
    };

    return (
        <>
            <JsonLd nodes={[profilePage]} />
            <HomeSwitch work={work} life={life} />
        </>
    );
}
