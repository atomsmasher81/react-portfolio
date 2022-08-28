import React from 'react';
import  VectorGif  from '../assets/Programming.gif'
import  Resume  from '../assets/Kartik Gautam_Resume.pdf'
import  VectorGifBlack  from '../assets/Programming-black.gif'
import TextTransition, { presets } from "react-text-transition";

const TEXTS = [
  "Software Developer",
  "Web Designer",
  "Photographer",

];

const Home=({currTheme})=>
{
    console.log("currTheme",currTheme)
        const [index, setIndex] = React.useState(0);

          React.useEffect(() => {
            const intervalId = setInterval(() =>
              setIndex(index => index + 1),
              3000 // every 3 seconds
            );
            return () => clearTimeout(intervalId);
          }, []);
        return (
      <div className="h-4/5 flex flex-row justify-center py-10 items-center" >
        <div className="w-2/5 h-full ml-10">
            <div className="about-text flex flex-col items-start pt-20">
                <h1 className=" my-6 ml-0 flex flex-col items-start">
                    <span className="mr-0 text-2xl">Hey folks, <span className="text-sm"> my name is </span> </span>
                    <div className="text-5xl -ml-1  text-violet-900 my-2 font-semibold dark:text-[#7c28ff]" >Kartik Gautam</div>
                    <div className= "flex justify-center mt-4 h-10">
                        <div className="pt-2">and i'm a</div>
                        <TextTransition springConfig={presets.wobbly} className="text-2xl text-[#FF6B6B] ml-2">
                        {TEXTS[index % TEXTS.length]}
                    </TextTransition>
                    </div>

                </h1>
                <div className="text-left">
                    Experienced Lead Software Engineer with a demonstrated history of working in the financial services industry. Skilled in Python,Django, Jinja, C++, and JavaScript. Strong engineering professional with a Bachelor's degree focused in Information Technology.
                </div>
                <div className="mt-10 font-medium  text-lg text-slate-900 dark:text-white">
                    <a href={Resume} target="_blank" download="Kartik Gauatam Resume" className="hover:text-slate-500">
                        <i className="link link-underline link-underline-black text-black " /> Download Resume

                    </a>
                    <a href="https://twitter.com/messages/compose?recipient_id=2893896902&text=Hey%20there!" target="_blank"
                       className="ml-16 py-10 hover:text-slate-500">Reach Out on twitter</a></div>
            </div>
        </div>
        <div className="w-2/5 flex justify-end" >
            { (currTheme === 'dark') ? (
                <img className="w-3/5" src={VectorGifBlack} alt="img black"/>
            ) : (
                <img className="w-3/5" src={VectorGif} alt="img"/>
            )}

        </div>

      </div>
  );
}

export default Home;