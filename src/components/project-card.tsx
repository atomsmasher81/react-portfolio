'use client';
import { useRef, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { Tooltip } from 'antd';
import Link from "next/link";

export const ProjectCard = ({ project }: { project: any }) => {
    return project.link ? (
        <Link href={project.link} target="_blank" className="block h-full">
            <ProjectCardElement project={project} />
        </Link>
    ) : (
        <ProjectCardElement project={project} />
    );
}

const ProjectCardElement = ({ project }: { project: any }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [rotation, setRotation] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);

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

    // Calculate shadow offset based on rotation
    const shadowX = rotation.y * 0.5; // Adjust multiplier to control shadow movement
    const shadowY = -rotation.x * 0.5;
    const shadowBlur = Math.abs(rotation.x) + Math.abs(rotation.y) + 5; // Dynamic blur based on tilt

    return (
        <Card 
            ref={cardRef}
            className="w-full h-full flex flex-col transition-all duration-200 ease-out"
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
        >
            <CardContent className="flex-1 flex flex-col">
                <div className="flex justify-between align-middle pt-4 flex-col h-full">
                    <div className="flex justify-between">
                        <h3 className="font-bold ">{project.title}</h3>
                        {
                            isHovered ? (
                                project.link ? (
                                    <Image 
                                        src="/svg/external-link.svg" 
                                        width={18} 
                                        height={18} 
                                        alt="site link"
                                        className="transition-all duration-200 hover:scale-110 hover:brightness-110"
                                    />
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
                        {/* {project.link &&  && (
                            <Image 
                                src="/svg/external-link.svg" 
                                width={18} 
                                height={18} 
                                alt="site link"
                                className="transition-all duration-200 hover:scale-110 hover:brightness-110"
                            />
                        )}
                        {!isHovered && (
                            <h6 className="text-gray-500">
                                {project.year}
                            </h6>
                        )} */}
                    </div>

                    <div className="flex-1 flex flex-col justify-between">
                        <p className="pt-4">{project.description}</p>
                        <p className="font-light text-sm mt-auto pt-4">{project.subtext}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}; 