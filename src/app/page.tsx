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
import Image from 'next/image'
import Link from "next/link";
import {PageWrapper} from "@/components/page-wrappper";
import {ProjectSection} from "@/components/project-section";
const Jobs = [
  {
    title: 'TopHire.co',
    child : [
        {title: 'Senior Software Engineer',
        content: 'Owns full-stack development of several features, deploying and managing LLMs and servers.'},
        ],
    titleSubText: '',
    companyLink: 'https://tophire.co'
  },
  {
    title: 'Credgenics',
    company: 'Tech Lead',
    companyLink: 'https://credgenics.com',
      child : [
          {title: 'Lead Backend Engineer', content: 'Owned and scaled Payments Product and lead the payments team.'},
           {title: 'Software Engineer',
               content: 'Built and managed the payments product from scratch,setup the building blocks for the product.'}
      ]
    // duration: ''
  },
    {
        title: 'Credicxo',
        child: [
            {title: 'Lead Backend Engineer',
                content: 'Owned and scaled several Products and lead the Backend team,owned Product roadmap.'},
            {title: 'Software Engineer',
                content: 'Built and managed the several products from scratch,wrote migration scripts,configured servers.'}
        ],
        companyLink: 'https://www.f6s.com/company/credicxo#about'
    },

]
export default function Home() {
  return (
      <PageWrapper>
        <div>

          <div className="text-base sm:text-lg">
            <p className="mb-6 sm:mb-8">
            With 6+ years as a full-stack developer, I’ve built seamless frontends, robust backends, and efficient DevOps pipelines while shaping product strategies. As a consultant and freelancer, I’ve helped startups bring ideas to life, scale platforms, and lead technical teams.
            </p>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Projects</h2>

            <ProjectSection highlight={true} />

            <div className="flex justify-end my-4">
            
            <Link 
              href="/projects" 
              className="text-gray-500  transition-transform hover:text-gray-900 group hover:scale-105 flex items-center"
            >
              <span className="mr-1">Checkout all projects</span>
              <span className="inline-block transition-transform group-hover:translate-x-1"> →</span>
            </Link>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-4">Experience</h2>
            <ul className="list-disc pl-5 space-y-4 ">
              {Jobs.map((company) => (
                  <li key={company.title} className="group">
                      <Link href={company.companyLink} className="h-6 inline-flex items-center" target="_blank">
                        <div className="flex justify-start items-center">
                          <span className="font-bold mr-2">{company.title}</span>
                          <Image 
                            src="/svg/external-link.svg" 
                            width={20} 
                            height={20} 
                            alt="site link"
                            className="transition-all duration-200 hover:scale-110 hover:brightness-110 opacity-0 group-hover:opacity-100"
                          />
                        </div>
                      </Link>
                      <span className="text-sm"> {company.titleSubText}</span>
                      <br/>
                        <ul className="relative">
                            {company.child.map((job) => (
                                <div key={job.title} >
                                    <li><span>{job.title}</span> </li>
                                    <div className="my-2 list-disc">
                                        <p className="text-sm font-light"> - {job.content}</p>
                                    </div>
                                    {/*<br/>*/}
                                </div>
                            ))}
                            {/*{company.child.length > 1 && <div className="line absolute w-2 bg-black"></div>}*/}
                        </ul>
                  </li>
              ))}

            </ul>

          </div>
        </div>
      </PageWrapper>
  )
}

//
// function EggIcon(props) {
//   return (
//     <svg
//       {...props}
//       xmlns="http://www.w3.org/2000/svg"
//       width="24"
//       height="24"
//       viewBox="0 0 24 24"
//       fill="none"
//       stroke="currentColor"
//       strokeWidth="2"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//     >
//       <path d="M12 22c6.23-.05 7.87-5.57 7.5-10-.36-4.34-3.95-9.96-7.5-10-3.55.04-7.14 5.66-7.5 10-.37 4.43 1.27 9.95 7.5 10z" />
//     </svg>
//   )
// }
//
//
// function HeadphonesIcon(props) {
//   return (
//     <svg
//       {...props}
//       xmlns="http://www.w3.org/2000/svg"
//       width="24"
//       height="24"
//       viewBox="0 0 24 24"
//       fill="none"
//       stroke="currentColor"
//       strokeWidth="2"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//     >
//       <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
//     </svg>
//   )
// }
//
//
//
// function CodeIcon(props) {
//   return (
//       <svg
//           {...props}
//           xmlns="http://www.w3.org/2000/svg"
//           width="24"
//           height="24"
//           viewBox="0 0 24 24"
//           fill="none"
//           stroke="currentColor"
//           strokeWidth="2"
//           strokeLinecap="round"
//           strokeLinejoin="round"
//       >
//         <polyline points="16 18 22 12 16 6" />
//         <polyline points="8 6 2 12 8 18" />
//       </svg>
//   )
// }
//
//
// function ImageIcon(props) {
//   return (
//     <svg
//       {...props}
//       xmlns="http://www.w3.org/2000/svg"
//       width="24"
//       height="24"
//       viewBox="0 0 24 24"
//       fill="none"
//       stroke="currentColor"
//       strokeWidth="2"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//     >
//       <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
//       <circle cx="9" cy="9" r="2" />
//       <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
//     </svg>
//   )
// }
//
//
// function LinkedinIcon(props) {
//   return (
//     <svg
//       {...props}
//       xmlns="http://www.w3.org/2000/svg"
//       width="24"
//       height="24"
//       viewBox="0 0 24 24"
//       fill="none"
//       stroke="currentColor"
//       strokeWidth="2"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//     >
//       <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
//       <rect width="4" height="12" x="2" y="9" />
//       <circle cx="4" cy="4" r="2" />
//     </svg>
//   )
// }
//
//
// function XIcon(props) {
//   return (
//     <svg
//       {...props}
//       xmlns="http://www.w3.org/2000/svg"
//       width="24"
//       height="24"
//       viewBox="0 0 24 24"
//       fill="none"
//       stroke="currentColor"
//       strokeWidth="2"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//     >
//       <path d="M18 6 6 18" />
//       <path d="m6 6 12 12" />
//     </svg>
//   )
// }
