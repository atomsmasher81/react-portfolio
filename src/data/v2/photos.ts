// My photos, newest first. Images live in
// /public/images/photos (metadata stripped). Captions are cleaned of hashtags;
// a few are left empty where the caption was mostly someone else's words.

export interface Photo {
    id: string;
    src: string;
    w: number;
    h: number;
    title: string;
    caption: string;
    place: string;
    date: string; // ISO
    pick?: boolean; // favourites: these lead the photo pile on the life home
}

export const photos: Photo[] = [
    {
        "id": "CaM54s_Pq-A",
        "src": "/images/photos/CaM54s_Pq-A.jpg",
        "w": 640,
        "h": 480,
        "title": "So much more to say",
        "caption": "So much more to say\nAnd even more to listen.\n\nI sit in solitude and wonder,\nWas it because of the limited time\nOr because of other priorities.\n\nBut it is still too early to say\nIt's too soon to come to a conclusion\n\nMaybe time have a different plan altogether\nOr maybe those other priorities will stand strong,\nlong enough to finish everything.\n\nThe universe always finds a funny way to do things\nAnd maybe this will be delightfully funny\nI hope :)\n\nand the absurdity of me ... writing this.",
        "place": "",
        "date": "2022-02-20",
        "pick": true
    },
    {
        "id": "CVno922ve6z",
        "src": "/images/photos/CVno922ve6z.jpg",
        "w": 640,
        "h": 800,
        "title": "The default fallback",
        "caption": "The default fallback",
        "place": "",
        "date": "2021-10-29",
        "pick": true
    },
    {
        "id": "CSH05sftf_O",
        "src": "/images/photos/CSH05sftf_O.jpg",
        "w": 640,
        "h": 335,
        "title": "Prem Mandir, Vrindavan",
        "caption": "प्रेम मंदिर, वृन्दावन",
        "place": "",
        "date": "2021-08-03",
        "pick": true
    },
    {
        "id": "CQRK0-FNHpQ",
        "src": "/images/photos/CQRK0-FNHpQ.jpg",
        "w": 640,
        "h": 800,
        "title": "The city at night",
        "caption": "",
        "place": "",
        "date": "2021-06-18",
        "pick": true
    },
    {
        "id": "CPttj6vNYEX",
        "src": "/images/photos/CPttj6vNYEX.jpg",
        "w": 640,
        "h": 800,
        "title": "I understand",
        "caption": "I understand,\nBecause that's what i do\n\nWhen things become unbearable to deal with\n\nWhen you don't feel like talking for days\n\nWhen you are unsure of your position in this world\n\nOr when you simply can't choose between butterscotch and chocolate\n\nJust remember one thing\nYou are not alone,\nI am with you ... always\nAnd\nI understand\n\nBecause that's what i do",
        "place": "",
        "date": "2021-06-04",
        "pick": false
    },
    {
        "id": "CIGug_9gwsv",
        "src": "/images/photos/CIGug_9gwsv.jpg",
        "w": 640,
        "h": 480,
        "title": "Farewells",
        "caption": "...and if someone would have screamed my name I wouldn’t have heard for I’ve said goodbye so many times in my short life that farewells are a muscular task and I’ve taught them well.\nThere’s a place by the side of the railway near the lake where I grew up and I used to go there to burry things and start anew.\nI used to go there to say goodbye.\nI was young and did not know many people but I had hidden things inside that I never dared to show and in silence I tried to kill them,\none way or the other,\nleaving sin on my body\nscrubbing tears off with salt\nand I built my rituals in farewells.\nEndings I still cling to.\n\nThen days passed by and I spent them with my work\nand now I’m writing letters I will never dare to send.\nBut there is this one day every year or so\nwhen the burden gets too heavy\nand I collect my belongings I no longer need\nand make my way to the ocean to burn and drown and start anew\nand it is quite wonderful, setting fire to my chains and flames on written words\nand I stand there, starring deep into the heat until they’re all gone.\nNothing left to hold me back.",
        "place": "",
        "date": "2020-11-27",
        "pick": false
    },
    {
        "id": "CBgdmPag3eU",
        "src": "/images/photos/CBgdmPag3eU.jpg",
        "w": 640,
        "h": 480,
        "title": "If you forget me",
        "caption": "\"Well, Now,\nIf little by little you stop loving me i shall stop loving you little by little.\nIf suddenly you forget me do not look for me , for i shall already have forgotten you.\n If you it think long and mad , the wind of banners that passes through my life and you decide to leave me at the shore of the heart where i have roots ,\nremember that on that day , at that hour , i shall lift my arm and my roots will set off to seek another land\" - Pablo neurda , if you forget me\n\nAfter Pablo Neruda, “If You Forget Me”",
        "place": "Delhi, India",
        "date": "2020-06-16",
        "pick": false
    },
    {
        "id": "B-pz9gFg-Ep",
        "src": "/images/photos/B-pz9gFg-Ep.jpg",
        "w": 640,
        "h": 480,
        "title": "Happy",
        "caption": "When ends meets,\nFrom the make believe paradise\nTo this implausible world,\nfor a brief time\nor through a little incident,\nIn that instance\nOne truly starts to grasp\nthe enormity of life,\nas everything fades for that moment\nand only the sense of smile is left.\nOnly for that tick of the clock\none has found the 'Happy'. .",
        "place": "",
        "date": "2020-04-06",
        "pick": false
    },
    {
        "id": "B9L-RklAg0d",
        "src": "/images/photos/B9L-RklAg0d.jpg",
        "w": 640,
        "h": 640,
        "title": "Step by step",
        "caption": "Mein kaadam kaadam badalta hu yahi...\nYe zindgi badalti hi nahi...",
        "place": "",
        "date": "2020-03-01",
        "pick": false
    },
    {
        "id": "B6Y4y_JAtec",
        "src": "/images/photos/B6Y4y_JAtec.jpg",
        "w": 640,
        "h": 800,
        "title": "The world was somewhere else",
        "caption": "Comes the tipping point in life, when we decide to a ‘stop and search’ and our emotional police bring us to a standstill. This allows us to scan all the little details in the spectrum of our being; scour all fuzzy or cryptic elements that are floating around in our mind and restore the fault lines in the cluttered tale of our life.\n\n(\"The world was somewhere else\") -Erik Pevernagie",
        "place": "",
        "date": "2019-12-22",
        "pick": false
    },
    {
        "id": "B5iNspVAyqt",
        "src": "/images/photos/B5iNspVAyqt.jpg",
        "w": 640,
        "h": 480,
        "title": "Caesar is in danger",
        "caption": "It's been way to much now,\nHe don't want to hold it inside anymore.\n\nFor the pain he carry inside him\nIs bigger than his stomach.\n\nFor the worries he carry inside him\nAre heavier than his own weight.\n\nHe don't want to hold it anymore,\nHe don't want to feel it anymore.\n\nThe bird who dreamt of flying in freedom\nis stuck in strom somewhere.\n\nThe idolizer who was a firm believer\nis loosing hope now,\nHe has been for quite a while now.\n\nThis all is a scam,\nThis all is a conspiracy.\n\nCeaser is in danger now,\nHe needs a savior.",
        "place": "",
        "date": "2019-12-01",
        "pick": true
    },
    {
        "id": "B3rA-42AMGl",
        "src": "/images/photos/B3rA-42AMGl.jpg",
        "w": 640,
        "h": 456,
        "title": "Life will break you",
        "caption": "Life will break you.\nNobody can protect you from that,\nand living alone won't either,\nfor solitude will also break you with its yearning.\nYou have to love.\nYou have to feel.\nIt is the reason you are here on earth.\nYou are here to risk your heart.\nYou are here to be swallowed up.\nAnd when it happens that you are\nbroken, or betrayed, or left, or hurt,\nor death brushes near, let yourself\nsit by an apple tree and\nlisten to the apples falling all around you in heaps,\nwasting their sweetness. Tell yourself \"you tasted as many as you could.”\n\nAfter Louise Erdrich, The Painted Drum",
        "place": "",
        "date": "2019-10-16",
        "pick": false
    },
    {
        "id": "B2hI0apgoII",
        "src": "/images/photos/B2hI0apgoII.jpg",
        "w": 640,
        "h": 480,
        "title": "I am a traveler",
        "caption": "I am traveler,\nTrying to find my destination in every stop i make,\nOr stumble upon willingly or unwillingly.\nBut the soil on any stop doesn't welcome me like i hope it would,\nSo i cover my feets with hard boots thinking unlike the soil maybe the store would welcome me\nAnd there too, i have to face disappointment.\n\nNow here i am again, going back to the road  and again thinking that this time i will not stop anywhere but the end of the road...if it exists",
        "place": "",
        "date": "2019-09-17",
        "pick": false
    },
    {
        "id": "BjDSQoSDdOz",
        "src": "/images/photos/BjDSQoSDdOz.jpg",
        "w": 640,
        "h": 640,
        "title": "The last piece of the puzzle",
        "caption": "What if i tell u i tried,would u believe me then...\ni tried but it didn't make any difference\nI tried but i haven't move an inch from where i was yesterday\nAnd after every effort, i try to make something out of it .so that the next time, i can go a little further in what i think is the right direction\n but all of  this dosen't make any sense anymore..\nThere is something i am missing\nMaybe there is something left to figure out in the process\nMaybe some right things to say\nMaybe some right thing to do\nOr maybe some right things to believe\n\nWhatever this last part of the puzzle is\n It is not inside the box\nAnd maybe it's time to search  somewhere else\nIn something far greater then that puzzle box...",
        "place": "Greater Noida",
        "date": "2018-05-21",
        "pick": false
    },
    {
        "id": "BetS6PpF6wo",
        "src": "/images/photos/BetS6PpF6wo.jpg",
        "w": 640,
        "h": 398,
        "title": "After the rain",
        "caption": "Why don't we rewrite the star ,\nMay be the world could be ours....tonight.\n\nAfter “Rewrite the Stars”, from The Greatest Showman",
        "place": "",
        "date": "2018-02-02",
        "pick": false
    },
    {
        "id": "Bdzh8ljliti",
        "src": "/images/photos/Bdzh8ljliti.jpg",
        "w": 640,
        "h": 360,
        "title": "Life always finds a way",
        "caption": "Life always finds the way.....",
        "place": "Muzaffarnagar",
        "date": "2018-01-11",
        "pick": false
    },
    {
        "id": "BcM93DGFmO8",
        "src": "/images/photos/BcM93DGFmO8.jpg",
        "w": 640,
        "h": 573,
        "title": "Roses are red",
        "caption": "Roses are red ,\n leaves are green,\nalways be ready cuz\n somethings are just unforeseen",
        "place": "",
        "date": "2017-12-02",
        "pick": false
    },
    {
        "id": "BY7yLcRFWLz",
        "src": "/images/photos/BY7yLcRFWLz.jpg",
        "w": 640,
        "h": 500,
        "title": "Memories",
        "caption": "Memories that haunts u for life. .",
        "place": "",
        "date": "2017-09-12",
        "pick": false
    },
    {
        "id": "BYQ0IHaFhPI",
        "src": "/images/photos/BYQ0IHaFhPI.jpg",
        "w": 640,
        "h": 800,
        "title": "There was a sunset",
        "caption": "I swear there was a beautiful sunset but man this stupid phone came in-between..",
        "place": "",
        "date": "2017-08-26",
        "pick": false
    },
    {
        "id": "BOHLGcUjF71",
        "src": "/images/photos/BOHLGcUjF71.jpg",
        "w": 640,
        "h": 640,
        "title": "India Gate, morning",
        "caption": "The morning glory of monument is just awesome",
        "place": "",
        "date": "2016-12-17",
        "pick": false
    },
    {
        "id": "BN3bAliDF24",
        "src": "/images/photos/BN3bAliDF24.jpg",
        "w": 640,
        "h": 640,
        "title": "Nightmares",
        "caption": "A night brings many nightmare .....its upto you if you want to believe them...",
        "place": "Muzaffarnagar",
        "date": "2016-12-11",
        "pick": false
    },
    {
        "id": "BMcP30FlKF6",
        "src": "/images/photos/BMcP30FlKF6.jpg",
        "w": 640,
        "h": 360,
        "title": "Take this light",
        "caption": "Take this light and enlighten your life......take this warmth and feel comfy.....take this darkness and feel good cuz darkness in your life is less this this.....",
        "place": "",
        "date": "2016-11-05",
        "pick": false
    },
    {
        "id": "BMMQz0pjN_B",
        "src": "/images/photos/BMMQz0pjN_B.jpg",
        "w": 640,
        "h": 640,
        "title": "Diwali",
        "caption": "On the occasion of diwali ....here is a diwali special....",
        "place": "",
        "date": "2016-10-30",
        "pick": false
    },
    {
        "id": "BL6w1zPj2Wj",
        "src": "/images/photos/BL6w1zPj2Wj.jpg",
        "w": 640,
        "h": 360,
        "title": "Light a candle",
        "caption": "Its better to light the candle than curse the darkness....",
        "place": "",
        "date": "2016-10-23",
        "pick": false
    },
    {
        "id": "BLpd8H9DCf4",
        "src": "/images/photos/BLpd8H9DCf4.jpg",
        "w": 640,
        "h": 800,
        "title": "Rust",
        "caption": "Power of nature slowly passing everything in to nothingness.... ..",
        "place": "NIET, Greater Noida",
        "date": "2016-10-17",
        "pick": false
    },
    {
        "id": "BJxD-b3hwqU",
        "src": "/images/photos/BJxD-b3hwqU.jpg",
        "w": 640,
        "h": 640,
        "title": "Fly away",
        "caption": "",
        "place": "",
        "date": "2016-08-31",
        "pick": false
    },
    {
        "id": "BJoJr8HBisj",
        "src": "/images/photos/BJoJr8HBisj.jpg",
        "w": 640,
        "h": 800,
        "title": "Randomness",
        "caption": "On a random road,\nTook a random click,\nFind out that randomness can be beautiful.....",
        "place": "",
        "date": "2016-08-27",
        "pick": false
    },
    {
        "id": "BJGNJtThm17",
        "src": "/images/photos/BJGNJtThm17.jpg",
        "w": 640,
        "h": 640,
        "title": "If I were a tree",
        "caption": "If I were a tree, I would have no reason to love human...",
        "place": "",
        "date": "2016-08-14",
        "pick": false
    },
    {
        "id": "BICzMWbhPfX",
        "src": "/images/photos/BICzMWbhPfX.jpg",
        "w": 640,
        "h": 640,
        "title": "Have some aam",
        "caption": "Have some aam...",
        "place": "",
        "date": "2016-07-19",
        "pick": false
    },
    {
        "id": "BHxGrgXhnkH",
        "src": "/images/photos/BHxGrgXhnkH.jpg",
        "w": 640,
        "h": 640,
        "title": "The dark side",
        "caption": "Let's start with the dark side of our  life.....",
        "place": "",
        "date": "2016-07-12",
        "pick": false
    }
];


// All images are already web-sized, so thumbnails are the same file.
export const thumb = (photo: Photo, _width?: number) => photo.src;
