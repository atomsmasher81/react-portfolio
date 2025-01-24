'use client';

import React from 'react';
import {PageWrapper} from "@/components/page-wrappper";
import {blogs} from "@/data/blogs";
import {motion} from "framer-motion";
import {notFound} from "next/navigation";
import ReactMarkdown from 'react-markdown';
import Link from "next/link";
import Script from 'next/script';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import remarkGfm from 'remark-gfm';

interface BlogPostProps {
    params: {
        id: string;
    };
}

const BlogPost = ({params}: BlogPostProps) => {
    const blog = blogs.find((b) => b.id === params.id);

    if (!blog) {
        notFound();
    }

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: blog.title,
        description: blog.description || blog.title,
        author: {
            '@type': 'Person',
            name: 'Kartik Gautam',
            url: 'https://kartikgautam.com'
        },
        datePublished: blog.date,
        dateModified: blog.date,
        image: 'https://kartikgautam.com/img/kartik.png',
        publisher: {
            '@type': 'Person',
            name: 'Kartik Gautam',
            logo: {
                '@type': 'ImageObject',
                url: 'https://kartikgautam.com/img/kartik.png'
            }
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://kartikgautam.com/blogs/${blog.id}`
        },
        keywords: blog.tags?.join(', '),
        articleBody: blog.content
    };

    return (
        <PageWrapper>
            <Script id="blog-jsonld" type="application/ld+json">
                {JSON.stringify(jsonLd)}
            </Script>
            <motion.article
                className="max-w-3xl mx-auto px-4 py-8"
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                exit={{opacity: 0, y: 20}}
                transition={{delay: 0.3}}
                itemScope
                itemType="https://schema.org/BlogPosting"
            >
                <nav aria-label="Breadcrumb" className="mb-4">
                    <ol className="flex space-x-2 text-sm text-gray-600">
                        <li><Link href="/" className="hover:text-blue-600">Home</Link></li>
                        <li>/</li>
                        <li><Link href="/blogs" className="hover:text-blue-600">Blogs</Link></li>
                        <li>/</li>
                        <li className="text-gray-900" aria-current="page">{blog.title}</li>
                    </ol>
                </nav>

                <Link 
                    href="/blogs" 
                    className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 mb-12 group transition-colors"
                >
                    <span className="mr-2 transform group-hover:-translate-x-1 transition-transform">←</span>
                    <span>all blogs</span>
                </Link>

                <header className="mb-8">
                    <h1 itemProp="headline" className="text-4xl font-bold mb-4">{blog.title}</h1>
                    <div className="flex flex-wrap gap-4 items-center text-gray-600">
                        <time itemProp="datePublished" dateTime={blog.date} className="text-sm">{blog.date}</time>
                        <span>•</span>
                        <span className="text-sm">{blog.readTime}</span>
                    </div>
                    {blog.tags && (
                        <div className="flex flex-wrap gap-2 mt-4">
                            {blog.tags.map((tag) => (
                                <Link 
                                    key={tag} 
                                    href={`/blogs/tag/${tag.toLowerCase()}`}
                                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700"
                                >
                                    {tag}
                                </Link>
                            ))}
                        </div>
                    )}
                </header>

                <div 
                    itemProp="articleBody"
                    className="prose dark:prose-invert max-w-none 
                        prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-8 
                        prose-p:text-gray-600 dark:prose-p:text-gray-300 prose-p:my-4 prose-p:leading-relaxed
                        prose-li:text-gray-600 dark:prose-li:text-gray-300
                        prose-strong:text-gray-900 dark:prose-strong:text-white
                        prose-ul:my-6 prose-ul:list-disc prose-ol:list-decimal prose-li:my-2
                        prose-pre:my-0 prose-pre:bg-transparent prose-pre:p-0
                        prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-700 prose-blockquote:pl-4 prose-blockquote:italic">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({node, ...props}) => <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-2xl font-bold mt-8 mb-4" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-xl font-bold mt-6 mb-3" {...props} />,
                            p: ({node, ...props}) => <p className="my-4 leading-relaxed" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-6 my-4" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-6 my-4" {...props} />,
                            li: ({node, ...props}) => <li className="my-2" {...props} />,
                            blockquote: ({node, ...props}) => (
                                <blockquote className="border-l-4 border-gray-300 dark:border-gray-700 pl-4 my-4 italic" {...props} />
                            ),
                            code({className, children, ...props}: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                const language = match ? match[1] : '';
                                const isInline = !match;
                                return isInline ? (
                                    <code className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800" {...props}>
                                        {children}
                                    </code>
                                ) : (
                                    <div className="rounded-lg overflow-hidden my-6 bg-gray-900 dark:bg-gray-800">
                                        <SyntaxHighlighter
                                            style={vscDarkPlus}
                                            language={language}
                                            PreTag="div"
                                            customStyle={{
                                                margin: 0,
                                                borderRadius: '0.5rem',
                                                padding: '1.5rem',
                                            }}
                                            {...props}
                                        >
                                            {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                    </div>
                                );
                            }
                        }}
                    >
                        {blog.content}
                    </ReactMarkdown>
                </div>

                <footer className="mt-12 pt-8 border-t">
                    <h2 className="text-2xl font-bold mb-4">Related Posts</h2>
                    <div className="grid gap-6 md:grid-cols-2">
                        {blogs
                            .filter(p => p.id !== blog.id && p.tags?.some(t => blog.tags?.includes(t)))
                            .slice(0, 2)
                            .map(relatedPost => (
                                <Link 
                                    key={relatedPost.id} 
                                    href={`/blogs/${relatedPost.id}`}
                                    className="block p-4 border rounded-lg hover:shadow-md transition-shadow"
                                >
                                    <h3 className="font-semibold mb-2">{relatedPost.title}</h3>
                                    <p className="text-sm text-gray-600">{relatedPost.description}</p>
                                </Link>
                            ))}
                    </div>
                </footer>
            </motion.article>
        </PageWrapper>
    );
};

export default BlogPost; 