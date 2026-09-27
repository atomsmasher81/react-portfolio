import Link from "next/link";
import { blogs } from "@/data/blogs";

export const metadata = { title: "Blogs", description: "Longer posts on building and scaling software." };

export default function BlogsPage() {
    const posts = [...blogs].sort((a, b) => b.date.localeCompare(a.date));

    return (
        <div className="mx-auto max-w-2xl">
            <header className="pb-12 pt-14 sm:pt-24">
                <h1 className="v2-display text-[2.75rem] sm:text-[3.25rem]">Blogs</h1>
                <p className="mt-4 text-[17px] leading-relaxed text-[var(--muted)]">
                    Longer posts on building and scaling software. Mostly things I wish someone had told me earlier.
                </p>
            </header>
            <ul className="v2-focus-list border-t border-[var(--faint)]">
                {posts.map((b) => (
                    <li key={b.id} className="border-b border-[var(--faint)]">
                        <Link href={`/blogs/${b.id}`} className="group block py-5">
                            <div className="flex items-baseline justify-between gap-4">
                                <h2 className="font-medium leading-snug">{b.title}</h2>
                                <span className="v2-mono shrink-0 text-xs text-[var(--muted)]">
                                    {new Date(b.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                                </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[15px] text-[var(--muted)]">{b.description}</p>
                            <p className="mt-2 text-xs text-[var(--muted)]">{b.readTime}</p>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
