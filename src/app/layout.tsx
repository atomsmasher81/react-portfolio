import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import {Avatar, AvatarImage} from "@/components/ui/avatar";
import Link from "next/link";
import Image from "next/image";
import React, {useEffect} from "react";
import {AnimatePresence, motion} from "framer-motion";
import { usePathname } from "next/navigation";
import TopLayout from "@/components/TopLayout";
import GoogleAnalytics from "@/components/GoogleAnalytics";

const inter = Inter({ subsets: ["latin"] });

// Your Google Analytics Measurement ID
const GA_MEASUREMENT_ID = "G-ZPHPHMKFVR"; 

export const metadata: Metadata = {
  title: "Kartik Gautam",
  description: "Software Engineer | Consultant | Entrepreneur",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en">
      <body className={inter.className}>
        <GoogleAnalytics GA_MEASUREMENT_ID={GA_MEASUREMENT_ID} />
        <TopLayout />
        {children}
      </body>
      </html>
  );
}
