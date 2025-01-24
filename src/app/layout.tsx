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
  title: "Kartik Gautam | Consultant | Full Stack Developer | Entrepreneur",
  description: "Full Stack Developer with 6+ years of experience in building scalable applications, leading teams, and consulting for startups. Expertise in frontend, backend, and DevOps.",
  keywords: ["Full Stack Developer", "Software Engineer", "Consultant", "React", "Node.js", "DevOps", "Technical Lead","Entrepreneur","python"],
  authors: [{ name: "Kartik Gautam" }],
  creator: "Kartik Gautam",
  publisher: "Kartik Gautam",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://kartik-gautam.com",
    title: "Kartik Gautam | Consultant | Full Stack Developer | Entrepreneur",
    description: "Full Stack Developer with 6+ years of experience in building scalable applications, leading teams, and consulting for startups.",
    siteName: "Kartik Gautam Portfolio",
    images: [
      {
        url: "https://kartik-gautam.com/img/kartik.png",
        width: 2700,
        height: 2700,
        alt: "Kartik Gautam - Full Stack Developer & Technical Consultant"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Kartik Gautam | Consultant | Full Stack Developer | Entrepreneur",
    description: "Full Stack Developer with 6+ years of experience in building scalable applications, leading teams, and consulting for startups.",
    creator: "@kartik_gautam_",
    images: ["https://kartik-gautam.com/img/kartik.png"]
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  metadataBase: new URL('https://kartik-gautam.com'),
  alternates: {
    canonical: '/',
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
