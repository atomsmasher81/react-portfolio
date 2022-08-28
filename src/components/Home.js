import React from 'react';
import  VectorGif  from '../assets/Programming.gif'


const Home=()=>
{
  return (
      <div className="h-4/5 flex flex-row justify-center py-10 items-center" >
        <div className="w-2/5 h-full ml-10">
            <div className="about-text flex flex-col items-start pt-20">
                {/*<small className="small-text">Welcome to <span className="mobile-block">my portfolio website!</span></small>*/}
                <h1 className=" my-6 ml-0 flex flex-col items-start">
                    <span className="mr-0 text-2xl">Hey folks, I'm</span>
                    <div className="text-5xl -ml-1  text-violet-900 my-2 font-semibold" >Kartik Gautam</div>
                    <div className="mt-4 text-2xl text-[#FF6B6B]">
                        <span className="">Web Designer</span>
                        <span className="">UI Specialist</span>
                    </div>
                </h1>
                <div className="text-left">
                    Experienced Lead Software Engineer with a demonstrated history of working in the financial services industry. Skilled in Python,Django, Jinja, C++, and JavaScript. Strong engineering professional with a Bachelor's degree focused in Information Technology.
                </div>
                <div className="mt-10 font-medium  text-lg text-slate-900">
                    <a href="" className="">
                        <i className="link link-underline link-underline-black text-black" /> Download Resume

                    </a>
                    <a href="#contact" className="ml-16 py-10">Reach Out!</a></div>
            </div>
        </div>
        <div className="w-2/5 flex justify-end" >
            <img className="w-3/5" src={VectorGif} alt="img"/>
        </div>

      </div>
  );
}

export default Home;