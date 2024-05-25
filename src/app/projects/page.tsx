import React from 'react';
import {Card, CardContent} from "@/components/ui/card";
import {PageWrapper} from "@/components/page-wrappper";
import Image from "next/image";
import { Tooltip } from 'antd';
import Link from "next/link";

const projects = [
    {
        title: 'Hereme',
        description: 'Network management app ',
        subtext : 'That lets you create and share personalized cards while tracking detailed view statistics.'
        // website: 'https://hereme.com'
    },

    {
        title: 'OneLLM',
        description: 'A unified interface for LLMs',
        subtext: 'Pay for one and get all the LLMs in one place.',
        // github: 'https://github.com/atomsmasher81'
    },
    {
        title: 'MicroBites',
        description: 'Get daily summaries of your WhatsApp groups',
        subtext: 'Helping you stay updated without sifting through hundreds of messages.',
        // website: 'https://microbites.dorik.io/'
    },
    {
        title: 'AlertCam',
        description: 'Transforms your device camera into a security system.',
        subtext:  'Using OpenCV for facial recognition, instantly alerting the admin when an unknown face is detected.',
        // github: 'https://github.com/atomsmasher81'
    }

]

const Project = () => {
  return (
      <PageWrapper>
          <div className="max-w-4xl mx-auto p-4 pt-0 sm:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {projects.map((project) => (
                        <Card className="w-full" key={project.title}>
                            <CardContent>
                                <div className="flex justify-between align-middle pt-4">
                                    <h3 className="font-bold ">{project.title}</h3>
                                    <div className="flex justify-around">
                                        {project.github ? (
                                            <Tooltip showArrow={true} title="github" mouseEnterDelay={0.3} overlayClassName={"text-xs"}>
                                                <Link href={project.github} target="_blank">
                                                    <Image src="/svg/github.svg" width={20} height={20} alt="github"/>
                                                </Link>
                                            </Tooltip>
                                        ) : null}

                                        {project.website ? (
                                            <Tooltip  showArrow={true}  title="website" mouseEnterDelay={0.3} overlayClassName={"text-xs"}>
                                                <Link href={project.website} target="_blank">
                                                    <Image className="ml-2" src="/svg/external-link.svg" width={18} height={18} alt="site link"/>
                                                </Link>
                                            </Tooltip>
                                        ) : null}
                                    </div>
                                </div>

                                <p className="pt-4">{project.description}</p>
                                <br/>
                                <p className="font-light text-sm">{project.subtext}</p>
                            </CardContent>
                        </Card>
                  ))}

              </div>
          </div>
      </PageWrapper>

  );
};

export default Project;