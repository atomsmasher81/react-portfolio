import { blogs } from "@/data/blogs";
import { projects } from "@/data/projects";
import { notes } from "@/data/v2/notes";
import { now } from "@/data/v2/now";
import { profile } from "@/data/v2/profile";
import { experience, workIntro } from "@/data/v2/work";
import { SITE_URL } from "@/lib/seo";

// llms.txt (llmstxt.org): a plain Markdown map of the site for AI assistants,
// so a question about Kartik Gautam is answered from his own words. The -full
// variant inlines every post and note.
const plain = (s: string) => s.replace(/\*\*/g, "");

export function llmsTxt(full: boolean) {
    const roles = experience
        .map((r) => `- **${r.positions[0].title}, ${r.company}** (${r.period}): ${r.positions[0].summary}`)
        .join("\n");
    const work = projects
        .filter((p) => p.link || p.github)
        .map((p) => `- [${p.title}](${p.link || p.github}): ${p.description}. ${p.subtext}`)
        .join("\n");
    const posts = [...blogs]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((b) => `- [${b.title}](${SITE_URL}/blogs/${b.id}) (${b.date}): ${b.description}`)
        .join("\n");
    const noteList = notes.map((n) => `- [${n.title}](${SITE_URL}/notes/${n.slug}) (${n.date}): ${n.excerpt}`).join("\n");

    let out = `# Kartik Gautam

> ${workIntro.body}

${plain(workIntro.headline)} Currently: ${experience.find((r) => r.current)?.positions[0].title} at ${experience.find((r) => r.current)?.company}. Based in India. Contact: ${profile.email}. Book a call: ${profile.bookingUrl}. Profiles: ${profile.socials.map((s) => `${s.label} ${s.href}`).join(", ")}.

## Experience

${roles}

## Projects

${work}

## Pages

- [Home](${SITE_URL}): who Kartik is, work history, testimonials
- [Projects](${SITE_URL}/projects): everything built since 2019
- [Journey](${SITE_URL}/journey): the long-form life story
- [Now](${SITE_URL}/now) (updated ${now.updated}): ${now.paragraphs.map(plain).join(" ")}
- [Photos](${SITE_URL}/photos): photography with captions
- [Sky](${SITE_URL}/sky): the night sky and a listenable pulsar

## Blog posts

${posts}

## Notes

${noteList}
`;

    if (full) {
        out += `\n# Full text\n`;
        for (const b of blogs) out += `\n---\n\n## ${b.title}\n\nURL: ${SITE_URL}/blogs/${b.id} · Published ${b.date} · By Kartik Gautam\n\n${b.content.replace(/^\s*# .*\n+/, "")}\n`;
        for (const n of notes) out += `\n---\n\n## ${n.title}\n\nURL: ${SITE_URL}/notes/${n.slug} · Published ${n.date} · By Kartik Gautam\n\n${n.body}\n`;
    }
    return out;
}
