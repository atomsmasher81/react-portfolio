'use client';

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

const GA_ID = "G-ZPHPHMKFVR";
const CLARITY_ID = "yq56y4eo8e";
const DEPTHS = [25, 50, 75, 100];

// Google Analytics and Microsoft Clarity, production only. GA's own enhanced
// measurement already counts page views (including client-side navigation),
// outbound clicks and 90% scrolls; this adds finer scroll depth and names the
// links people leave through.
//
// ?kg_internal=1 marks this browser as my own traffic for a year (=0 undoes
// it): GA hits carry traffic_type=internal, which the property's "Internal
// Traffic" data filter drops, and Clarity sessions get an internal=true tag.
export default function Analytics() {
    useScrollDepth();
    useLinkClicks();

    if (process.env.NODE_ENV !== "production") return null;

    return (
        <>
            <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
            {/* Runs before any event is sent, so the flag is set before GA's first hit. */}
            <Script
                id="google-analytics"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());
                        var kgFlag = new URLSearchParams(location.search).get('kg_internal');
                        var kgScope = '; path=/; samesite=lax' + (location.protocol === 'https:' ? '; secure' : '');
                        if (kgFlag === '1') document.cookie = 'kg_internal=1; max-age=31536000' + kgScope;
                        if (kgFlag === '0') document.cookie = 'kg_internal=; max-age=0' + kgScope;
                        gtag('config', '${GA_ID}', /(?:^|; )kg_internal=1/.test(document.cookie) ? { traffic_type: 'internal' } : {});
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
                        if (/(?:^|; )kg_internal=1/.test(document.cookie)) clarity("set", "internal", "true");
                    `,
                }}
            />
        </>
    );
}

// How far down each page people get: 25, 50, 75 and 100%, once per page view.
// Pages that barely scroll are skipped, they'd read 100% on arrival.
function useScrollDepth() {
    const pathname = usePathname();

    useEffect(() => {
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
    }, [pathname]);
}

// Every way out of the site, named: which social, which project, the email.
function useLinkClicks() {
    useEffect(() => {
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
    }, []);
}
