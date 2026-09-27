// Prototype content for the v2 redesign.
// Anything marked DRAFT is placeholder copy; rewrite it in your own voice.

export type Lens = "work" | "life";

export const profile = {
    name: "Kartik Gautam",
    firstName: "Kartik",
    email: "hello@kartikgautam.com",
    bookingUrl: "https://cal.com/kartik-gautam/15min",
    timeZone: "Asia/Kolkata",
    available: true,
    socials: [
        { label: "GitHub", href: "https://github.com/atomsmasher81" },
        { label: "LinkedIn", href: "https://www.linkedin.com/in/kartik-gautam/" },
        { label: "X", href: "https://x.com/kartik_gautam_" },
    ],
};

export const lifeIntro = {
    lines: ["I look up a lot,", "take photos of ordinary things that catch my eye,", "and lose hours reading philosophy and psychology."],
    interests:
        "I'm happiest somewhere between **computer science**, **tinkering** with computers and building things, **photography**, **astronomy**, and the big questions in **science**, **philosophy** and **psychology**.",
    aside: "By day I write software. That lives on the other side of this site.",
};
