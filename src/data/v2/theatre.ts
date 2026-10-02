// The Magic Theatre: a hidden page, after Steppenwolf. Its sign only lights up
// at night, at the foot of the Now and Journey pages.
//
// What's behind the doors is NOT in this repo. It lives in
// private/theatre.json on the server (git ignores it; see
// private/theatre.example.json for the shape) and is served one room at a
// time by /api/theatre, so none of it ships in the site's code.

/** A picture left in a room, usually with a few words of its own. */
export interface RoomImage {
    src: string;
    caption?: string;
    date?: string;
}

/** Things that can be left in a room, by the shrine: each one from a scene in Steppenwolf. */
export type RoomObject = "whip" | "chess" | "rifle" | "coin" | "knife" | "wireless";

// Any room can also hold pictures (`images`) and objects (`objects`), and a
// photo room can also have words (`body`): a note often comes with a photo,
// and a photo with a note.
interface Extras {
    images?: RoomImage[];
    objects?: RoomObject[];
}

export type Room =
    | ({ kind: "text"; body: string[] } & Extras)
    | ({ kind: "moon"; body: string[] } & Extras)
    | ({ kind: "photo"; src: string; caption: string; date: string; body?: string[] } & Extras)
    | ({ kind: "quote"; body: string[]; quote: string; by: string } & Extras)
    | ({ kind: "letter"; body: string[]; email: string; subject: string } & Extras);

/** What's on the outside of a door: safe to show before it's opened. */
export interface DoorPlate {
    id: string;
    plate: string; // the inscription on its plaque
}

export interface Door extends DoorPlate {
    room: Room;
}

export const theatre = {
    sign: "Magic Theatre",
    entrance: "Entrance not for everybody",
    admission: "For madmen only. Price of admission: your mind.",
    /** The programme: what this place is, for someone who walks in knowing nothing. */
    about: {
        title: "The Magic Theatre",
        source: [
            "The Magic Theatre comes from Steppenwolf, a novel by Hermann Hesse, first published in 1927.",
            "Its hero, Harry Haller, believes he is two beings in one body: a man, and a wolf of the steppes. One night he sees a sign over an old door that isn't there by day: MAGIC THEATRE. ENTRANCE NOT FOR EVERYBODY. FOR MADMEN ONLY. Later he is led inside, into a corridor of countless doors, each with its own inscription and its own scene behind it, and a great mirror in which he sees himself fall apart into many Harrys.",
        ],
        // DRAFT, in the owner's own words from the conversation: rewrite freely.
        why: ["I built this one for myself. It's where I keep the things I don't share anywhere else. It only opens at night."],
        how: ["Scroll to walk the corridor. Knock on a door to go in. The mirror is at the end."],
        links: [
            { label: "Steppenwolf, on Wikipedia", href: "https://en.wikipedia.org/wiki/Steppenwolf_(novel)" },
            { label: "Read it: the 1929 translation, on Wikisource", href: "https://en.wikisource.org/wiki/Steppenwolf" },
        ],
    },
};
