'use client';
import React, {useState} from 'react';
import {PageWrapper} from "@/components/page-wrappper";
import {AnimatePresence, motion} from "framer-motion";

const Blog = () => {
    const [isLoading, setIsLoading] = useState(true);

  const handleLoad = () => {
      setTimeout(() => {
          setIsLoading(false);
      }, 500)
    // setIsLoading(false);
  };
  return (
      <PageWrapper>
          <div className="max-w-4xl mx-auto p-4 sm:p-8 flex justify-center">

              {isLoading && <motion.div className="loader" exit={{opacity: 0 }}></motion.div>}
              <iframe src="https://cal.com/kartik-gautam/15min"
                      className={` ${isLoading ? 'hidden' : ''}`}
                      onLoad={handleLoad}
                      width="600px" height="800" title="Book a call"></iframe>
          </div>
      </PageWrapper>

  );
};

export default Blog;