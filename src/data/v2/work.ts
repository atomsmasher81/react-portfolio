// Professional side of the site. Facts and role descriptions come from the live
// portfolio; the tone is a record of work, not a pitch.

export const workIntro = {
    // Rendered as: {lead}<link to current company>{rest}
    now: {
        lead: "Right now I'm building AI agents for healthcare at ",
        rest: ".",
    },
    headline: "I build, ship and scale products, from the first commit to 10M+ transactions a day.",
    body: "I'm a senior full-stack engineer. I've built 0→1 products across fintech, hiring, healthcare, AI and e-signatures, including payment systems handling 10M+ transactions a day at 500+ requests a second, and I've led the teams building them from architecture to launch.",
};

export interface Position {
    title: string;
    summary: string;
}

export interface Role {
    company: string;
    href: string;
    about: string;
    period: string;
    current?: boolean;
    positions: Position[]; // newest first; more than one means a promotion
}

export const experience: Role[] = [
    {
        company: "RapidClaims",
        href: "https://www.rapidclaims.ai/",
        about: "AI revenue cycle management for healthcare",
        period: "Nov 2025–now",
        current: true,
        positions: [
            {
                title: "SDE 3",
                summary: "Building the full-stack systems behind RapidClaims' autonomous AI agents for medical coding, risk adjustment and denial management.",
            },
        ],
    },
    {
        company: "SignWith",
        href: "https://signwith.co",
        about: "Pay-per-document e-signatures",
        period: "Mar–Nov 2025",
        positions: [
            {
                title: "Chief Technology Officer",
                summary: "Led technology, architecture and product engineering for the platform.",
            },
        ],
    },
    {
        company: "TopHire",
        href: "https://tophire.co",
        about: "Tech jobs for the top 2% of engineers",
        period: "2023–24",
        positions: [
            {
                title: "Senior Software Engineer",
                summary: "Owned full-stack development of several features, and deployed and managed the LLMs and servers behind them.",
            },
        ],
    },
    {
        company: "Credgenics",
        href: "https://credgenics.com",
        about: "AI-driven debt collections",
        period: "2021–23",
        positions: [
            {
                title: "Tech Lead",
                summary: "Owned and scaled the payments product and led the payments team.",
            },
            {
                title: "Software Engineer",
                summary: "Built the payments product from scratch and set up its core building blocks.",
            },
        ],
    },
    {
        company: "Credicxo",
        href: "https://www.f6s.com/company/credicxo#about",
        about: "Lending to small businesses",
        period: "2019–21",
        positions: [
            {
                title: "Lead Backend Engineer",
                summary: "Owned and scaled several products, led the backend team and owned the product roadmap.",
            },
            {
                title: "Software Engineer",
                summary: "Built several products from scratch, wrote the migration scripts and configured the servers.",
            },
        ],
    },
];
