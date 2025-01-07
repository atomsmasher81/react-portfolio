'use client';
import React from 'react';
import {PageWrapper} from "@/components/page-wrappper";
import {motion} from "framer-motion";
import {blogs} from "@/data/blogs";
import {BlogCard} from "@/components/blog-card";

const Blog = () => {
  const sortedBlogs = blogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return (
      <PageWrapper>
<div className="max-w-4xl mx-auto px-4">

          <motion.div 
            className="space-y-8"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            transition={{delay: 0.3}}
          >
            {sortedBlogs.map((blog, index) => (
              <motion.div
                key={blog.id}
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{
                  delay: 0.1 * (index + 1),
                  duration: 0.5,
                  ease: "easeOut"
                }}
              >
                <BlogCard blog={blog} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </PageWrapper>
  );
};

export default Blog;