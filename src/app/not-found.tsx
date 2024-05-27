import Link from 'next/link'
import Image from "next/image";
import React from "react";
import {PageWrapper} from "@/components/page-wrappper";

import { Button, Flex } from 'antd';
export default function NotFound() {
  return (
      <PageWrapper>
      <div className="max-w-4xl mx-auto p-4 pt-0 sm:p-8 flex flex-col items-center">
          <Image src="/img/cat.png"
                 width={200} height={200}
                 alt="cat"
                 className=""
          />
          <p className="font-sans my-8 text-lg">even my magic cat couldn&apos;t find this page </p>


          <button className="bg-black text-white p-2 px-4 rounded-lg" >
              <Link href="/" className="">Back to About</Link>
          </button>

      </div>
          </PageWrapper>
  )
}