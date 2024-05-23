/**
 * v0 by Vercel.
 * @see https://v0.dev/t/yel6aFgwTHg
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"// import Link from "next/link"
import { CardContent, Card } from "@/components/ui/card"
import React from "react";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <Avatar>
          <AvatarImage alt="Profile Picture" src="/placeholder.svg?height=128&width=128" />
        </Avatar>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold">Kartik Gautam</h1>
        <p className="text-lg sm:text-xl">Engineer & Product Enthusiast</p>
        <div className="flex space-x-4 mt-4">
          <XIcon className="h-6 w-6" />
          <HeadphonesIcon className="h-6 w-6" />
          <LinkedinIcon className="h-6 w-6" />
        </div>
      </div>
      <hr className="my-6 sm:my-8" />
      <nav className="flex justify-center space-x-4 sm:space-x-6">
        <div className="text-base sm:text-lg font-medium" href="#">
          About
        </div>
        <div className="text-base sm:text-lg font-medium" href="#">
          Blogs
        </div>
        <div className="text-base sm:text-lg font-medium" href="#">
          Uses
        </div>
        <div className="text-base sm:text-lg font-medium" href="#">
          Newsletter
        </div>
        <div className="text-base sm:text-lg font-medium" href="#">
          Contact
        </div>
      </nav>
      <hr className="my-6 sm:my-8" />
      <div className="text-base sm:text-lg">
        <p className="mb-6 sm:mb-8">
          Founding Software Engineer & Designer at Speedy (YC-W23). Passionate about crafting tools that empower
          developers and designers to express themselves seamlessly.
        </p>
        <h2 className="text-xl sm:text-2xl font-bold mb-4">Experience</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <span className="font-bold">Founding Software Engineer</span>
            <span className="text-sm">(PRESENT)</span>
            <br />
            Speedybrand (YC-W23)
          </li>
          <li>
            <span className="font-bold">Front-End Engineer</span>
            <br />
            Maya Labs (YC-S22)
          </li>
        </ul>
        <h2 className="text-xl sm:text-2xl font-bold mt-6 sm:mt-8 mb-4">Projects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="w-full">
            <CardContent>
              <CodeIcon className="h-6 w-6 mb-2" />
              <h3 className="font-bold">syntaxUI</h3>
              <p>Ready-to-use UI elements designed for rapid development.</p>
            </CardContent>
          </Card>
          <Card className="w-full">
            <CardContent>
              <ImageIcon className="h-6 w-6 mb-2" />
              <h3 className="font-bold">Prettyfolio</h3>
              <p>A curated collection of portfolios for inspiration.</p>
            </CardContent>
          </Card>
          <Card className="w-full">
            <CardContent>
              <EggIcon className="h-6 w-6 mb-2" />
              <h3 className="font-bold">Enchant</h3>
              <p>A vibrant theme for Visual Studio Code.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function CodeIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}


function EggIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c6.23-.05 7.87-5.57 7.5-10-.36-4.34-3.95-9.96-7.5-10-3.55.04-7.14 5.66-7.5 10-.37 4.43 1.27 9.95 7.5 10z" />
    </svg>
  )
}


function HeadphonesIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
    </svg>
  )
}


function ImageIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  )
}


function LinkedinIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}


function XIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}
