import React from 'react';
import {PageWrapper} from "@/components/page-wrappper";
import { ProjectComponent } from "@/components/project-list";
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Projects | Kartik Gautam - Full Stack Developer',
    description: 'Explore my portfolio of full-stack development projects, including web applications, APIs, and technical solutions.',
    openGraph: {
        title: 'Projects | Kartik Gautam - Full Stack Developer',
        description: 'Explore my portfolio of full-stack development projects, including web applications, APIs, and technical solutions.',
    }
};

export default function ProjectPage() {
    return (
        <PageWrapper>
            <div className="space-y-4">
                <h1 className="sr-only">My Development Projects and Work</h1>
                <ProjectComponent highlight={true} />
                <ProjectComponent highlight={false} />
            </div>
        </PageWrapper>
    );
}



