import React from 'react';
import {Card, CardContent, CardHeader} from "@/components/ui/card";
import {Blog} from "@/types/blog";
import Link from "next/link";
import {motion} from "framer-motion";

interface BlogCardProps {
    blog: Blog;
}

export const BlogCard: React.FC<BlogCardProps> = ({blog}) => {
    return (
        <Link href={`/blogs/${blog.id}`} className="block">
            <motion.div
                whileHover={{scale: 1.01}}
                transition={{duration: 0.2}}
            >
                <Card className="w-full hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border border-gray-200 dark:border-gray-800">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col space-y-3">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                {blog.title}
                            </h2>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                                <time dateTime={blog.date}>{blog.date}</time>
                                <span>•</span>
                                <span>{blog.readTime}</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-600 dark:text-gray-300 mb-6 line-clamp-2 text-base">
                            {blog.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {blog.tags?.map((tag) => (
                                <span
                                    key={tag}
                                    className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-300"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </Link>
    );
}; 