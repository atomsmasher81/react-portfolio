'use client';
import React, {useEffect, useState} from 'react';
import {PageWrapper} from "@/components/page-wrappper";
import {motion} from "framer-motion";

const Blog = () => {


  useEffect(() => {
    window.SubstackFeedWidget = {
      substackUrl: "kartikgautam.substack.com",
      posts: 8
    };

    const script = document.createElement('script');
    script.src = "https://substackapi.com/embeds/feed.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    }
  }, []);

  return (
      <PageWrapper>
        <div className="max-w-4xl mx-auto flex justify-center items-center">

              <motion.div className="max-w-4xl mx-auto sm:p-8 flex justify-center"
                          initial={{opacity: 0, y: 20}}
                          animate={{opacity: 1, y: 0}}
                          exit={{opacity: 0, y: 20}}
                          transition={{delay: 0.3}}
              >
                <div id="substack-feed-embed" className="w-4/5"></div>
              </motion.div>


        </div>
      </PageWrapper>
  );
};

export default Blog;