import Link from "next/link";
import Image from "next/image";

export const metadata = { title: "Not found" };

export default function NotFound() {
    return (
        <div className="mx-auto flex max-w-2xl flex-col items-start pb-24 pt-20 sm:pt-28">
            <Image src="/img/cat.png" width={140} height={140} alt="A cat" />
            <h1 className="v2-display mt-8 text-[2.5rem]">Nothing here.</h1>
            <p className="mt-3 text-[17px] text-[var(--muted)]">Even my magic cat couldn&apos;t find this page.</p>
            <Link href="/" className="v2-link mt-8 text-[15px]">
                Back home
            </Link>
        </div>
    );
}
