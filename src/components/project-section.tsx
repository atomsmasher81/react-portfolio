'use client';
import { ProjectComponent } from "@/app/projects/page";

export const ProjectSection = ({ highlight }: { highlight: boolean }) => {
    return (
        <div className="flex justify-between">
            <ProjectComponent highlight={highlight} />
        </div>
    );
}; 