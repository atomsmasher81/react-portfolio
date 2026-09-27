// Notes are short, unpolished reflections: a digital garden, not a blog.
// First drafts written from Kartik's own answers. Edit freely.

export interface Note {
    slug: string;
    title: string;
    date: string; // ISO
    tags: string[];
    excerpt: string;
    body: string; // markdown
}

export const notes: Note[] = [
    {
        slug: "whats-left",
        title: "What's left when you strip it all away",
        date: "2026-09-25",
        tags: ["life", "psychology"],
        excerpt: "Most of what I want might not be mine. I'm trying to find the part that is.",
        body: `Most of what I want might not be mine.

A lot of it was handed to me: by family, by school, by whatever everyone around me was chasing at the time. Expectations, habits, the quiet programming of growing up somewhere. None of that is bad. But it makes me wonder what's actually underneath.

If you took all of it away, the should-dos and the supposed-to-wants, what would be left of a person? Something must be. And whatever that is, I suspect it's what we actually want to do with our lives.

I don't have an answer. I'm just trying to notice, more often, when I'm wanting something because I was told to.`,
    },
    {
        slug: "look-up-once-a-night",
        title: "Look up once a night",
        date: "2026-09-18",
        tags: ["astronomy", "life"],
        excerpt: "The sky has a way of shrinking our problems back to their real size.",
        body: `I genuinely believe that if everyone looked at the night sky once a night, they'd live a little differently.

Not because of some big revelation. Just because it's hard to stay wound up about a meeting, an argument or a number on a screen while you're looking at light that left its star before anyone you know was born.

Everything up there is so much bigger than we imagine. And down here we get so caught up in the mess we've made for ourselves. A minute of looking up is the cheapest perspective I know.`,
    },
    {
        slug: "the-moon-followed-me",
        title: "The moon followed me",
        date: "2026-09-10",
        tags: ["astronomy", "childhood"],
        excerpt: "As a kid I was sure it was following us. The real reason is almost better.",
        body: `As a kid, walking at night, I was convinced the moon was following me. Trees and houses slid past as I walked, and the moon just stayed there, keeping up.

The reason turns out to be distance. Things close to you swing past quickly as you move. The moon is about 384,000 km away, so over a walk down the street its direction doesn't change at all, as far as your eyes can tell. Everything nearby slides away while the moon stays put, and your brain reads that as the moon keeping pace.

I love that the explanation didn't make it less magical. It just swapped one kind of wonder for another: it's so far away that from where we stand, it barely moves at all.`,
    },
    {
        slug: "the-brain-rewires",
        title: "The brain rewires",
        date: "2026-08-28",
        tags: ["psychology", "science"],
        excerpt: "Neuroplasticity is the most hopeful idea I've come across in science.",
        body: `For a long time I assumed people were more or less fixed. You are how you are.

Then I started reading about neuroplasticity: the brain keeps rewiring itself through life. Connections you use get stronger, ones you stop using fade. What you repeatedly do and think slowly changes the physical thing doing the thinking.

That's the most hopeful idea I've come across in science. It means the programming I keep wondering about isn't permanent. It was learned, and things that were learned can, slowly, be relearned.`,
    },
    {
        slug: "frozen-not-mundane",
        title: "Frozen, not mundane",
        date: "2026-08-15",
        tags: ["photography"],
        excerpt: "A still photo takes an ordinary second and refuses to let it go.",
        body: `What I love about stills is that they take an ordinary second and refuse to let it go.

A wall in late light. The moon over a water tank. A stranger's hands. None of it is special while you're walking past. Freeze it, and suddenly there's room to look, and it turns out there was a lot going on.

Most of what I shoot is exactly that: night skies, the moon, and ordinary things that happened to catch my eye. All on my phone for now.`,
    },
];
