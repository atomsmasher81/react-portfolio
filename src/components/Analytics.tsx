'use client';

import { useEffect, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { NO_TRACK_KEY, track } from "@/lib/analytics";

const GA_ID = "G-ZPHPHMKFVR";
const CLARITY_ID = "yq56y4eo8e";
const DEPTHS = [25, 50, 75, 100];

// Google Analytics and Microsoft Clarity, production only. GA's own enhanced
// measurement already counts page views (including client-side navigation),
// outbound clicks and 90% scrolls; this adds finer scroll depth and names the
// links people leave through.
//
// Visiting any page with ?notrack keeps this browser out of both for good
// (?notrack=0 undoes it), so my own visits don't muddy the numbers.
export default function Analytics() {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        if (process.env.NODE_ENV !== "production") {
            setEnabled(true);
            return;
        }
        const flag = new URLSearchParams(window.location.search).get("notrack");
        try {
            if (flag === "0") localStorage.removeItem(NO_TRACK_KEY);
            else if (flag !== null) localStorage.setItem(NO_TRACK_KEY, "1");
            setEnabled(localStorage.getItem(NO_TRACK_KEY) !== "1");
        } catch {
            setEnabled(flag === null);
        }
    }, []);

    useScrollDepth(enabled);
    useLinkClicks(enabled);

    if (!enabled || process.env.NODE_ENV !== "production") return null;

    return (
        <>
            <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
            <Script
                id="google-analytics"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());
                        gtag('config', '${GA_ID}');
                    `,
                }}
            />
            <Script
                id="microsoft-clarity"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
                        (function(c,l,a,r,i,t,y){
                            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                        })(window, document, "clarity", "script", "${CLARITY_ID}");
                    `,
                }}
            />
        </>
    );
}

// How far down each page people get: 25, 50, 75 and 100%, once per page view.
// Pages that barely scroll are skipped, they'd read 100% on arrival.
function useScrollDepth(enabled: boolean) {
    const pathname = usePathname();

    useEffect(() => {
        if (!enabled) return;
        const seen = new Set<number>();
        let frame = 0;
        const check = () => {
            frame = 0;
            const doc = document.documentElement;
            const scrollable = doc.scrollHeight - window.innerHeight;
            if (scrollable < 200) return;
            const percent = ((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100;
            for (const d of DEPTHS) {
                if (percent >= (d === 100 ? 98 : d) && !seen.has(d)) {
                    seen.add(d);
                    track("scroll_depth", { percent: d });
                }
            }
        };
        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(check);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", onScroll);
            cancelAnimationFrame(frame);
        };
    }, [enabled, pathname]);
}

// Every way out of the site, named: which social, which project, the email.
function useLinkClicks(enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;
        const onClick = (e: MouseEvent) => {
            const a = (e.target as HTMLElement | null)?.closest?.("a");
            if (!a?.href) return;
            const label = (a.getAttribute("aria-label") || a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
            if (a.protocol === "mailto:") {
                track("email_click", { label }, { key: true });
            } else if (a.host && a.host !== window.location.host) {
                track("link_out", { label, link_url: a.href, link_domain: a.hostname.replace(/^www\./, "") });
            }
        };
        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
    }, [enabled]);
}
