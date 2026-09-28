// A /now page, in the spirit of nownownow.com: what you'd tell a friend
// you hadn't seen in a year. Written as prose, not a form. **Bold** words
// get a hand-drawn highlight. Update `updated` whenever you edit it.

export interface NowEntry {
    updated: string; // ISO date
    location: string;
    paragraphs: string[];
    reading?: { title: string; author: string; image: string; caption: string };
    // The song on loop. `youtube` is a video id (it plays inline), `spotify` a track id.
    listening?: { title: string; artist: string; year: number; cover: string; youtube: string; spotify?: string };
}

// DRAFT
export const now: NowEntry = {
    updated: "2026-09-27",
    location: "India",
    paragraphs: [
        "Right now I'm **reading** Gertrude by Hermann Hesse. It's an old beat-up copy, and I've mostly been reading it in the park.",
        "I'm **learning** about the brain, mostly neuroplasticity and how it manages to rewire itself.",
        "And I'm **making** this site, trying to get it to feel more like me and less like a resume.",
    ],
    reading: {
        title: "Gertrude",
        author: "Hermann Hesse",
        image: "/images/reading-gertrude.jpg",
        caption: "Gertrude, in the park",
    },
    listening: {
        title: "Ravi",
        artist: "Sajjad Ali",
        year: 2019,
        cover: "/images/now-ravi.jpg",
        youtube: "qaQ5soWs9sU",
        spotify: "0sT56zcByY6pW1EQcNDCla",
    },
};
