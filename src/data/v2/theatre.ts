// The Magic Theatre: a hidden page, after Steppenwolf. Its sign only lights up
// on the Sky page at night (the visitor's night), and behind each door is a
// small room. Everything here is Kartik's own words from around the site;
// swap any room for something unpublished, or add doors, freely.

export type Room =
    | { kind: "text"; body: string[] }
    | { kind: "moon"; body: string[] }
    | { kind: "photo"; src: string; caption: string; date: string }
    | { kind: "quote"; body: string[]; quote: string; by: string }
    | { kind: "letter"; body: string[]; email: string; subject: string };

export interface Door {
    id: string;
    plate: string; // the inscription above the door
    room: Room;
}

export const theatre = {
    sign: "Magic Theatre",
    entrance: "Entrance not for everybody",
    admission: "For madmen only. Price of admission: your mind.",
    doors: [
        {
            id: "hack",
            plate: "The first hack",
            room: {
                kind: "text",
                body: [
                    "Our first computer arrived when I was in fourth grade. My brother and I mostly used it for Midtown Madness, Vice City and Prince of Persia.",
                    "Then I started poking around in its settings and system files. A \"renew your Windows license\" reminder kept popping up, so I dug through the registry until I found what was behind it and made it stop.",
                    "It was my first real hack, and I've been tinkering with computers ever since.",
                ],
            },
        },
        {
            id: "moon",
            plate: "Why the moon followed me home",
            room: {
                kind: "moon",
                body: [
                    "As a kid I was sure the moon was following me. I'd walk home at night, glance up, and there it was, keeping pace, while the houses and trees slid past.",
                    "The moon still keeps pace when I walk home. I still check.",
                ],
            },
        },
        {
            id: "photo",
            plate: "One more photo",
            room: {
                kind: "photo",
                src: "/images/photos/BJoJr8HBisj.jpg",
                caption: "On a random road,\nTook a random click,\nFind out that randomness can be beautiful.....",
                date: "2016-08-27",
            },
        },
        {
            id: "souls",
            plate: "All of you, and none",
            room: {
                kind: "quote",
                body: [
                    "Steppenwolf starts with a man who sees himself in black and white. Two personalities living in one body, rubbing against each other, rotting each other.",
                    "Slowly the story moves away from those two separate halves, toward the idea that we are all of those things, and at the same time none of them.",
                ],
                quote: "Eternity is a mere moment, just long enough for a joke.",
                by: "Hermann Hesse, Steppenwolf",
            },
        },
        {
            id: "question",
            plate: "Is it worth wanting?",
            room: {
                kind: "text",
                body: [
                    "We're all defined by something: our jobs, our careers, how supportive or loving we are, or a trait someone pins on us.",
                    "The question I keep coming back to is whether the life we want is actually worth wanting, or just the one everyone around us happened to want first.",
                    "I'm somewhere in the middle of finding out.",
                ],
            },
        },
        {
            id: "letter",
            plate: "For the one who found this",
            room: {
                kind: "letter",
                body: ["You found the Magic Theatre. Not many do.", "If you've come this far, write to me and tell me what you felt on the way here."],
                email: "hello@kartikgautam.com",
                subject: "I found the Magic Theatre",
            },
        },
    ] satisfies Door[],
};
