import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The share card for links posted to X, LinkedIn, Slack and friends: the
// page's title large, who wrote it underneath. 1200×630 is what every
// platform crops to.
export const ogSize = { width: 1200, height: 630 };

// Set in Noto Sans, which next/og drew every card in until Next 16 switched its
// default to Geist; given the same name and weight it had, so cards look as they did.
const fonts = [{ name: "sans serif", data: readFileSync(join(process.cwd(), "src/lib/fonts/noto-sans-v27-latin-regular.ttf")), weight: 700 as const, style: "normal" as const }];

export function ogCard({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
    const size = title.length > 70 ? 56 : title.length > 40 ? 68 : 84;
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "72px 80px",
                    background: "#ffffff",
                    color: "#111111",
                    fontFamily: "sans-serif",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, color: "#6b6b6b" }}>
                    <div style={{ width: 14, height: 14, borderRadius: 7, background: "#6c5fd4" }} />
                    {eyebrow}
                </div>
                <div style={{ display: "flex", flexDirection: "column", maxWidth: 1000 }}>
                    <div style={{ display: "flex", fontSize: size, fontWeight: 600, lineHeight: 1.12, letterSpacing: -1.5 }}>{title}</div>
                    {subtitle && <div style={{ display: "flex", marginTop: 24, fontSize: 32, lineHeight: 1.35, color: "#6b6b6b" }}>{subtitle}</div>}
                </div>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                        borderTop: "2px solid #ececec",
                        paddingTop: 28,
                        fontSize: 28,
                    }}
                >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600 }}>Kartik Gautam</span>
                        <span style={{ color: "#6b6b6b", marginTop: 4 }}>Senior full-stack engineer</span>
                    </div>
                    <span style={{ color: "#6c5fd4" }}>kartikgautam.com</span>
                </div>
            </div>
        ),
        { ...ogSize, fonts },
    );
}
