'use client';
import { ProjectComponent } from "@/components/project-list";

export const ProjectSection = ({ highlight }: { highlight: boolean }) => {
    return (
        <div className="flex justify-between">
            <ProjectComponent highlight={highlight} />
        </div>
    );
}; 