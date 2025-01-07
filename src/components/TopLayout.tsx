'use client';
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {Avatar, AvatarImage} from "@/components/ui/avatar";
import {motion} from "framer-motion";
import { useState, useEffect } from 'react';

const tabs = [
    {
        id: "about",
        label: "About",
        route: "/",
    },
    {
        id: "blogs",
        label: "Blogs",
        route: "/blogs",
    },
    {
        id: "projects",
        label: "Projects",
        route: "/projects",
    },
    {
        id: "contact",
        label: "Contact",
        route: "/contact",
    },
];

function TopLayout() {
    const pathname = usePathname();
    const [showText, setShowText] = useState(true);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowText(false);
        }, 5000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="max-w-4xl mx-auto p-4 pb-0 sm:p-8 sm:pb-0">
            <div className="flex flex-col items-center text-center">
                <Avatar className="h-20 w-20">
                    <AvatarImage alt="Profile Picture" src="/img/img.png" />
                </Avatar>
                <div className="flex flex-col items-center justify-center relative">
                    <h1 className="mt-4 mb-2 text-4xl">Kartik Gautam</h1>
                    <div className="flex items-center justify-center mb-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span className="text-m text-green-500 px-2 py-1 ml-2">
                            Available for projects
                        </span>
                    </div>
                    <p className="text-md font-light">Engineer & Product Enthusiast</p>
                </div>
                <div className="flex space-x-8 mt-8">
                    <Link href="https://github.com/atomsmasher81" target="_blank">
                        <Image src="/svg/github.svg" width={30} height={30} alt="github"/>
                    </Link>
                    <Link href="https://www.linkedin.com/in/kartik-gautam/" target="_blank">
                        <Image src="/svg/linkedin.svg" width={30} height={30} alt="linkedin" />
                    </Link>
                    <Link href="https://x.com/kartik_gautam_" target="_blank">
                        <Image src="/svg/twitter.svg" width={30} height={30} alt="twitter" />
                    </Link>
                </div>
            </div>
            <hr className="my-4 sm:my-4" />
            <div className="relative">
                <nav className="flex justify-center space-x-4 sm:space-x-6">
                    {tabs.map((tab) => (
                        <Link 
                            key={tab.id} 
                            className="page-button active"
                            href={tab.route}
                            scroll={false}
                        >
                            <motion.span
                                animate={{
                                    color: pathname === tab.route ? "#ffffff" : "#000000",
                                }}
                                transition={{ duration: 0.2, ease: [0.43, 0.13, 0.23, 0.96] }}
                            >
                                {tab.label}
                            </motion.span>

                            {pathname === tab.route && (
                                <motion.div 
                                    layoutId="active-indicator"
                                    className="active-indicator"
                                    transition={{ 
                                        duration: 0.5,
                                        type: "spring",
                                        bounce: 0.25,
                                    }}
                                />
                            )}
                        </Link>
                    ))}

                </nav>
            </div>
            <hr className="my-4 mb-6 sm:my-4" />
        </div>
    );
}

export default TopLayout;