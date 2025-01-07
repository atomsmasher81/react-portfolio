'use client';
import React, { useState, useRef } from 'react';
import { PageWrapper } from "@/components/page-wrappper";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const Contact = () => {
    const [showCalendar, setShowCalendar] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const handleLoad = () => {
        setTimeout(() => {
            setIsLoading(false);
        }, 500);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const circle = target.querySelector('.animate-circle') as HTMLElement;
        if (circle) {
            circle.style.left = `${x-7}px`;
            circle.style.top = `${y-7}px`;
        }
    };

    return (
        <PageWrapper>
            <div className="max-w-2xl mx-auto space-y-8">
                <h1 className="text-2xl font-bold mb-6">Let&apos;s Connect</h1>
                
                <div className="space-y-4">
                    <Link href="mailto:kartikgautam171@gmail.com" 
                          className="flex items-center p-4 border rounded-lg hover:shadow-md transition-all group relative overflow-hidden"
                          onMouseMove={handleMouseMove}>
                        <span className="animate-circle"></span>
                        <Image src="/svg/email.svg" width={24} height={24} alt="email" className="mr-4"/>
                        <div>
                            <h2 className="font-semibold">Email</h2>
                            <p className="text-sm text-gray-600">kartikgautam171@gmail.com</p>
                        </div>
                    </Link>

                    <Link href="https://linkedin.com/in/kartik-gautam" target="_blank"
                          className="flex items-center p-4 border rounded-lg hover:shadow-md transition-all group relative overflow-hidden"
                          onMouseMove={handleMouseMove}>
                        <span className="animate-circle"></span>
                        <Image src="/svg/linkedin.svg" width={24} height={24} alt="linkedin" className="mr-4"/>
                        <div>
                            <h2 className="font-semibold">LinkedIn</h2>
                            <p className="text-sm text-gray-600">Connect with me on LinkedIn</p>
                        </div>
                    </Link>

                    <button 
                        onClick={() => setShowCalendar(true)}
                        className="w-full flex items-center p-4 border rounded-lg hover:shadow-md transition-all group relative overflow-hidden"
                        onMouseMove={handleMouseMove}>
                        <span className="animate-circle"></span>
                        <Image src="/svg/calendar.svg" width={24} height={24} alt="calendar" className="mr-4"/>
                        <div className="text-left">
                            <h2 className="font-semibold">Schedule a Call</h2>
                            <p className="text-sm text-gray-600">Book a 15-minute chat</p>
                        </div>
                    </button>
                </div>

                <AnimatePresence>
                    {showCalendar && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="mt-8"
                        >
                            {isLoading && <motion.div className="loader mr-1/2" exit={{ opacity: 0 }}></motion.div>}
                            <iframe 
                                src="https://cal.com/kartik-gautam/15min"
                                className={`w-full min-h-[800px] ${isLoading ? 'hidden' : ''}`}
                                onLoad={handleLoad}
                                title="Book a call"
                            ></iframe>
                            {isLoading && <p className="text-gray-600 mt-4">Meow... Loading your calendar</p>}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </PageWrapper>
    );
};

export default Contact;