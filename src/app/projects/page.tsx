'use client';
import React from 'react';
import {PageWrapper} from "@/components/page-wrappper";
import { ProjectComponent } from "@/components/project-list";

const ProjectPage = () => {
    return (
        <PageWrapper>
            <div className="space-y-4">
                <ProjectComponent highlight={true} />
                <ProjectComponent highlight={false} />
            </div>
        </PageWrapper>
    );
};

export default ProjectPage;



