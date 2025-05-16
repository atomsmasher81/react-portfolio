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
import Script from 'next/script';

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
    companyLink: 'https://credgenics.com',
      child : [
          {title: 'Tech Lead', content: 'Owned and scaled Payments Product and lead the payments team.'},
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
        <Script id="schema-org" type="application/ld+json">
          {`
            [
              {
                "@context": "https://schema.org",
                "@type": "Person",
                "name": "Kartik Gautam",
                "jobTitle": "Full Stack Developer & Technical Consultant",
                "description": "Full Stack Developer with 6+ years of experience in building scalable applications, leading teams, and consulting for startups.",
                "url": "https://kartikgautam.com",
                "image": "https://kartikgautam.com/img/kartik.png",
                "email": "kartikgautam171@gmail.com",
                "sameAs": [
                  "https://linkedin.com/in/kartik-gautam",
                  "https://github.com/atomsmasher81",
                  "https://x.com/kartik_gautam_"
                ],
                "knowsAbout": [
                  "Full Stack Development",
                  "Software Architecture",
                  "Technical Leadership",
                  "DevOps",
                  "React",
                  "Node.js",
                  "Python",
                  "Cloud Computing",
                  "System Design",
                  "Database Design",
                  "API Development",
                  "Microservices"
                ],
                "alumniOf": [
                  {
                    "@type": "CollegeOrUniversity",
                    "name": "AKTU",
                    "sameAs": "https://aktu.ac.in"
                  }
                ],
                "skills": [
                  "JavaScript",
                  "TypeScript",
                  "Python",
                  "React",
                  "Node.js",
                  "AWS",
                  "Docker",
                  "Kubernetes",
                  "MongoDB",
                  "PostgreSQL",
                  "System Design",
                  "Technical Leadership"
                ],
                "award": [
                  {
                    "@type": "Award",
                    "name": "Best Performer Award",
                    "description": "Awarded for exceptional performance and leadership in technical projects",
                    "awardedBy": {
                      "@type": "Organization",
                      "name": "Credgenics"
                    },
                    "date": "2022"
                  }
                ],
                "workExperience": [
                  {
                    "@type": "WorkPosition",
                    "name": "Senior Software Engineer",
                    "startDate": "2023",
                    "worksFor": {
                      "@type": "Organization",
                      "name": "TopHire.co",
                      "url": "https://tophire.co"
                    },
                    "description": "Owns full-stack development of several features, deploying and managing LLMs and servers."
                  },
                  {
                    "@type": "WorkPosition",
                    "name": "Lead Backend Engineer",
                    "startDate": "2021",
                    "endDate": "2023",
                    "worksFor": {
                      "@type": "Organization",
                      "name": "Credgenics",
                      "url": "https://credgenics.com"
                    },
                    "description": "Owned and scaled Payments Product and lead the payments team."
                  },
                  {
                    "@type": "WorkPosition",
                    "name": "Lead Backend Engineer",
                    "startDate": "2019",
                    "endDate": "2021",
                    "worksFor": {
                      "@type": "Organization",
                      "name": "Credicxo",
                      "url": "https://www.f6s.com/company/credicxo"
                    },
                    "description": "Owned and scaled several Products and lead the Backend team, owned Product roadmap."
                  }
                ]
              },
              {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                  {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": "https://kartikgautam.com"
                  }
                ]
              },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "url": "https://kartikgautam.com",
                "name": "Kartik Gautam - Full Stack Developer & Technical Consultant",
                "description": "Portfolio and professional profile of Kartik Gautam, a Full Stack Developer and Technical Consultant with expertise in web development, cloud computing, and technical leadership.",
                "potentialAction": {
                  "@type": "SearchAction",
                  "target": "https://kartikgautam.com/search?q={search_term_string}",
                  "query-input": "required name=search_term_string"
                }
              }
            ]
          `}
        </Script>
        <main>
          <section className="text-base sm:text-lg">
            <h1 className="sr-only">Full Stack Developer & Technical Consultant</h1>
            <p className="mb-6 sm:mb-8">
              With 6+ years as a full-stack developer, I&apos;ve built seamless frontends, robust backends, and efficient DevOps pipelines while shaping product strategies. As a consultant and freelancer, I&apos;ve helped startups bring ideas to life, scale platforms, and lead technical teams.
            </p>
            
            <section aria-labelledby="projects-heading">
              <h2 id="projects-heading" className="text-xl sm:text-2xl font-bold mb-4">Featured Projects</h2>
              <ProjectSection highlight={true} />
              <div className="flex justify-end my-4">
                <Link 
                  href="/projects" 
                  className="text-gray-500 transition-transform hover:text-gray-900 group hover:scale-105 flex items-center"
                  aria-label="View all projects"
                >
                  <span className="mr-1">Checkout all projects</span>
                  <span className="inline-block transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                </Link>
              </div>
            </section>

            <section aria-labelledby="experience-heading">
              <h2 id="experience-heading" className="text-xl sm:text-2xl font-bold mt-8 mb-4">Professional Experience</h2>
              <ul className="list-disc pl-5 space-y-4" role="list">
                {Jobs.map((company) => (
                    <li key={company.title} className="group">
                        <Link href={company.companyLink} className="h-6 inline-flex items-center" target="_blank" rel="noopener noreferrer">
                          <div className="flex justify-start items-center">
                            <span className="font-bold mr-2">{company.title}</span>
                            <Image 
                              src="/svg/external-link.svg" 
                              width={20} 
                              height={20} 
                              alt={`Visit ${company.title} website`}
                              className="transition-all duration-200 hover:scale-110 hover:brightness-110 opacity-0 group-hover:opacity-100"
                            />
                          </div>
                        </Link>
                        <span className="text-sm"> {company.titleSubText}</span>
                        <br/>
                        <ul className="relative" role="list">
                            {company.child.map((job) => (
                                <div key={job.title}>
                                    <li><h3 className="text-lg font-semibold">{job.title}</h3></li>
                                    <div className="my-2 list-disc">
                                        <p className="text-sm font-light"> - {job.content}</p>
                                    </div>
                                </div>
                            ))}
                        </ul>
                    </li>
                ))}
              </ul>
            </section>
          </section>
        </main>
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
