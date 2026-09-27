// Notes are short, unpolished reflections: a digital garden, not a blog.
// Drafted from Kartik's own answers, his old Instagram captions, and the
// writers he keeps coming back to. Edit freely; they should sound like him.

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
        slug: "steppenwolf",
        title: "Steppenwolf",
        date: "2026-09-28",
        tags: ["books", "psychology"],
        excerpt: "Two personalities in one man, rubbing against each other, and the long way out.",
        body: `Steppenwolf starts with a man who sees himself in black and white. Two personalities living in one body, rubbing against each other, rotting each other. That friction is the whole turmoil of the book. The wolf is just the name he gives it.

Slowly the story moves away from those two separate halves, toward the idea that we are all of those things, and at the same time none of them.

A man who looked down on dancing, on jazz, on anything light, lets himself be taught to dance. Stiff at first, embarrassed, thinking too much. Then comes the masked ball, and somewhere in that loud, crowded night he stops watching himself. For the first time in his life he dissolves into a room full of strangers, and he's simply happy, without having to justify it to anyone.

The book ends in the Magic Theatre. He gets it wrong again, is sentenced to be laughed at, and walks out knowing he will have to play the game once more, and one day play it better.

> Eternity is a mere moment, just long enough for a joke.`,
    },
    {
        slug: "worth-wanting",
        title: "Is it worth wanting?",
        date: "2026-09-21",
        tags: ["life", "psychology"],
        excerpt: "Everyone asks what they want from life. I keep getting stuck on the question after that.",
        body: `Look around and almost everyone is defined by something. Their job, their career, the title after their name. Or how supportive they are, how loving they are to the people in their life. And when it isn't any of that, it's a trait: they're easy-going, they really take care of themselves, they do a lot for themselves.

I don't think any of that is fake. When you sit down and ask yourself what kind of life you want, those are exactly the things that bubble up. A good career. Being someone people can lean on. Being the calm one. The answers come easily, which might be the first thing that should make us suspicious.

Because the question I keep getting stuck on isn't what I want. It's the one after it: is the thing I want actually worth wanting?

René Girard had an uncomfortable idea about this. He thought most of our desires aren't really ours to begin with. We pick them up from the people around us, the way you start wanting something because someone you admire already wants it. If he's even half right, then a lot of what bubbles up when we ask ourselves what we want is borrowed. Not wrong, necessarily. Just borrowed.

That doesn't give me an answer. It gives me a better question. When I catch myself wanting something, a role, a kind of reputation, a kind of life, I try to ask where it came from, and whether I'd still want it if I'd never seen anyone else have it.

Most days I don't know yet.`,
    },
    {
        slug: "look-up-once-a-night",
        title: "Look up once a night",
        date: "2026-09-05",
        tags: ["astronomy", "life"],
        excerpt: "The moon used to follow me home. It still does, if I remember to look.",
        body: `As a kid I was sure the moon was following me. I'd walk home at night, glance up, and there it was, keeping pace, while the houses and trees slid past. It took me years to learn the boring reason: it's so far away that walking down a street doesn't change where it sits in the sky at all, so it looks like it's walking with you.

The boring reason didn't ruin it. If anything, it made the moon stranger.

I still believe, maybe naively, that if everyone looked at the night sky once a night, they'd live a little differently. Not because of some cosmic revelation. It's just hard to stay wound up about a deadline or an argument while you're looking at light that left its star long before any of your problems existed.

Every time I do look up, the same thing happens. Everything gets bigger than I imagined, and the mess we've made for ourselves down here gets a little smaller.

The moon still keeps pace when I walk home. I still check.`,
    },
];
