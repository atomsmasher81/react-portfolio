'use client';
import React from 'react';
import { ProjectCard } from "@/components/project-card";
import { projects } from "@/data/projects";

const ProjectsList = ({highlight}: {highlight: boolean}) => {
    const filteredProjects = projects.filter(project => project.highlight === highlight);
    
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
                <ProjectCard key={project.title} project={project} />
            ))}
        </div>
    );
};

export function ProjectComponent({ highlight }: { highlight: boolean }) {
    return <ProjectsList highlight={highlight} />;
} 