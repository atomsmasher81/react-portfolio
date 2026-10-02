'use client';

import { useEffect, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

const GA_ID = "G-ZPHPHMKFVR";
const CLARITY_ID = "yq56y4eo8e";
const DEPTHS = [25, 50, 75, 100];

// Runs with the HTML, before any of the page's JavaScript: GA's and Clarity's
// command queues, GA's config (so its page view is the first thing queued) and
// the internal-traffic flag. track() and tag() calls wait in these queues until
// the scripts below arrive.
const QUEUES = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    var kgFlag = new URLSearchParams(location.search).get('kg_internal');
    var kgScope = '; path=/; samesite=lax' + (location.protocol === 'https:' ? '; secure' : '');
    if (kgFlag === '1') document.cookie = 'kg_internal=1; max-age=31536000' + kgScope;
    if (kgFlag === '0') document.cookie = 'kg_internal=; max-age=0' + kgScope;
    var kgInternal = /(?:^|; )kg_internal=1/.test(document.cookie);
    gtag('config', '${GA_ID}', kgInternal ? { traffic_type: 'internal' } : {});
    window.clarity = window.clarity || function(){(window.clarity.q = window.clarity.q || []).push(arguments)};
    if (kgInternal) clarity("set", "internal", "true");
`;

// Google Analytics and Microsoft Clarity, production only. (Cloudflare Web
// Analytics isn't here: Cloudflare injects its beacon at the edge, and leaves
// it out for visitors in the EU, as set in the dashboard.) GA's own enhanced
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
    const settled = useSettled();

    if (process.env.NODE_ENV !== "production") return null;

    return (
        <>
            <script dangerouslySetInnerHTML={{ __html: QUEUES }} />
            {settled && (
                <>
                    <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
                    <Script strategy="afterInteractive" src={`https://www.clarity.ms/tag/${CLARITY_ID}`} />
                </>
            )}
        </>
    );
}

// The analytics scripts wait until the page has loaded and the browser is idle,
// so they never hold up the first paint or hydration. An iframe (the YouTube
// player on /now) keeps the load event waiting until it's in, so they don't
// wait for it longer than 3 seconds after hydration.
function useSettled() {
    const [settled, setSettled] = useState(false);

    useEffect(() => {
        let started = false;
        const start = () => {
            if (started) return;
            started = true;
            const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 1));
            idle(() => setSettled(true));
        };
        const timer = window.setTimeout(start, 3000);
        if (document.readyState === "complete") start();
        else window.addEventListener("load", start, { once: true });
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener("load", start);
        };
    }, []);

    return settled;
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
