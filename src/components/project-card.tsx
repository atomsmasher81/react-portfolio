'use client';
import { useRef, useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { Tooltip } from 'antd';
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, Code, Briefcase, ExternalLink } from "lucide-react";

export const ProjectCard = ({ project }: { project: any }) => {
    return <ProjectCardElement project={project} />
}

const ProjectCardElement = ({ project }: { project: any }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [rotation, setRotation] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [cardPosition, setCardPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });

    // Store card position when expanded
    useEffect(() => {
        if (isExpanded && cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect();
            setCardPosition({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            });
        }
    }, [isExpanded]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;

        const card = cardRef.current;
        const rect = card.getBoundingClientRect();
        
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        const rotateY = x / (rect.width / 20);
        const rotateX = -y / (rect.height / 20);

        setRotation({ x: rotateX, y: rotateY });
    };

    const handleMouseLeave = () => {
        setRotation({ x: 0, y: 0 });
    };

    const handleCardClick = (e: React.MouseEvent) => {
        // Don't expand if clicking on the link
        if ((e.target as HTMLElement).closest('a')) {
            return;
        }
        setIsExpanded(true);
    };

    // Calculate shadow offset based on rotation
    const shadowX = rotation.y * 0.5; // Adjust multiplier to control shadow movement
    const shadowY = -rotation.x * 0.5;
    const shadowBlur = Math.abs(rotation.x) + Math.abs(rotation.y) + 5; // Dynamic blur based on tilt

    return (
        <>
            <Card 
                ref={cardRef}
                className="w-full h-full flex flex-col transition-all duration-300 ease-out cursor-pointer"
                style={{
                    transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
                    transformStyle: 'preserve-3d',
                    boxShadow: `
                        ${shadowX}px ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, 0.1),
                        0 0 15px rgba(0, 0, 0, 0.05)
                    `
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={(e) => {
                    handleMouseLeave();
                    setIsHovered(false);
                }}
                onMouseEnter={() => setIsHovered(true)}
                onClick={handleCardClick}
            >
                <CardContent className="flex-1 flex flex-col">
                    <div className="flex justify-between align-middle pt-4 flex-col h-full">
                        <div className="flex justify-between">
                            <h3 className="font-bold ">{project.title}</h3>
                            {
                                isHovered ? (
                                    project.link ? (
                                        <Link href={project.link} target="_blank" className="block h-full">  
                                            <Image 
                                                src="/svg/external-link.svg" 
                                                width={18} 
                                                height={18} 
                                                alt="site link"
                                                className="transition-all duration-200 hover:scale-110 hover:brightness-110"
                                            />
                                        </Link>
                                    ) : (
                                        <h6 className="text-gray-500">
                                            {project.year}
                                        </h6>
                                    )
                                ) : (
                                    <h6 className="text-gray-500">
                                        {project.year}
                                    </h6>
                                )
                            }
                        </div>

                        <div className="flex-1 flex flex-col justify-between">
                            <p className="pt-4">{project.description}</p>
                            <p className="font-light text-sm mt-auto pt-4">{project.subtext}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Dialog for expanded view */}
            <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
                <DialogContent 
                    className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800"
                >
                    <div className="relative">
                        {/* Header with gradient background */}
                        <div className=" p-6 rounded-t-lg">
                            
                            <DialogHeader className="space-y-2">
                                <DialogTitle className="text-2xl font-bold text-black">{project.title}</DialogTitle>
                                <div className="flex items-center gap-2 text-gray-900">
                                    <Calendar className="h-4 w-4" />
                                    <span>{project.year}</span>
                                </div>
                            </DialogHeader>
                        </div>
                        
                        {/* Content area */}
                        <div className="p-6 space-y-6">
                            {/* Project description */}
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">About</h3>
                                <p className="text-gray-700 dark:text-gray-300">{project.description}</p>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">{project.subtext}</p>
                            </div>
                            
                            {/* Project details */}
                            {project.details && (   
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Role */}
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Briefcase className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                                            <h3 className="font-medium text-gray-900 dark:text-gray-100">Role</h3>
                                        </div>
                                        <p className="text-gray-700 dark:text-gray-300">{project.details.role}</p>
                                    </div>
                                    
                                    {/* Duration */}
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Calendar className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                                            <h3 className="font-medium text-gray-900 dark:text-gray-100">Duration</h3>
                                        </div>
                                        <p className="text-gray-700 dark:text-gray-300">{project.details.duration.join(' - ')}</p>
                                    </div>
                                    
                                    {/* Technologies */}
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 md:col-span-2">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Code className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                                            <h3 className="font-medium text-gray-900 dark:text-gray-100">Technologies</h3>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {project.details.technology.map((tech: string, index: number) => (
                                                <Badge key={index} variant="outline" className="bg-gray-50 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-800">
                                                    {tech}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Footer with action buttons */}
                        <DialogFooter className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
                            {project.link && (
                                <Link 
                                    href={project.link} 
                                    target="_blank" 
                                    className="inline-flex items-center px-4 py-2 bg-black text-white rounded-md hover:bg-gray-900 transition-colors"
                                >
                                    Visit Project
                                    <ExternalLink className="h-4 w-4 ml-2" />
                                </Link>
                            )}
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}; 