'use client';
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import {Avatar, AvatarImage} from "@/components/ui/avatar";
import Link from "next/link";
import Image from "next/image";
import React from "react";
import {AnimatePresence, motion} from "framer-motion";

const inter = Inter({ subsets: ["latin"] });

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
    const [selectedTab, setSelectedTab] = React.useState<string | null>("about");
    return (
        <div className="max-w-4xl mx-auto p-4 pb-0 sm:p-8 sm:pb-0">
      <div className="flex flex-col items-center text-center">
        <Avatar className="h-20 w-auto">
          <AvatarImage alt="Profile Picture" src="/img/img.png" />
        </Avatar>
        <h1 className="mt-4 mb-2 text-4xl sm:text-4xl ">Kartik Gautam</h1>
        <p className="text-md font-light">Engineer & Product Enthusiast</p>
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
      <hr className="my-2 sm:my-4" />
      <nav className="flex justify-center space-x-4 sm:space-x-6 relative">
          {tabs.map((tab) => (
              <Link key= {tab.id} className="page-button active"
                    href={tab.route}
                    scroll={false}
                    // onClick={() => setSelectedTab(tab.id)}>
                    onClick={() => setSelectedTab(tab.id)}>
                    <motion.span
                        animate={{
                            // scale: selectedTab === tab.id ? 1.1 : 1 ,

                            color: selectedTab === tab.id ? "#ffffff" : "#000000",}}
                        transition={{ duration: 0.2 ,ease: [0.43, 0.13, 0.23, 0.96],}}
                    >
                        {tab.label}
                    </motion.span>


                  {tab.id === selectedTab && <motion.div layoutId="active-indicator"
                                                         className="active-indicator"
                                                         transition={{ duration: 0.5 ,
                                                             type: "spring",
                                                         bounce: 0.25,}}
                  />}
              </Link>
          ))}

      </nav>
        <hr className="my-2 sm:my-4" />
    </div>

  );
}
// export const metadata: Metadata = {
//   title: "Create Next App",
//   description: "Generated by create next app",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en">

      <body className={inter.className}>
        <TopLayout />
        {children}

      </body>

      </html>
  );
}
