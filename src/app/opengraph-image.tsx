import { ogCard, ogSize } from "@/lib/og";

export const size = ogSize;
export const contentType = "image/png";
export const alt = "Kartik Gautam, senior full-stack engineer";

export default function Image() {
    return ogCard({ eyebrow: "kartikgautam.com", title: "I build, ship and scale products, from the first commit to 10M+ transactions a day." });
}
