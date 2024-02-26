import React from 'react';
import  VectorGif  from '../assets/Programming.gif'
import  Resume  from '../assets/Kartik Gautam_Resume.pdf'
import  VectorGifBlack  from '../assets/Programming-black.gif'
import TextTransition, { presets } from "react-text-transition";
// import MyThree from './mythree';
import WaveComponent from './wave';
import HeroBackground from './heroBackground';
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
          <div>

            <HeroBackground/>
          </div>
  );
}

export default Home;