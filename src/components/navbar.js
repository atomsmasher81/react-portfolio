import React from 'react';
import KartikName from '../assets/kartik.png';
import KartikNameWhite from '../assets/kartik-white.png';
import Moon from '../assets/moon-white.png';
import { ReactComponent as Sun } from '../assets/svgs/sun.svg'


const setDark = (setTheme) => {
    console.log("setting dark")
  // 2
  localStorage.setItem("theme", "dark");

  // 3
  document.documentElement.setAttribute("data-theme", "dark");
  setTheme('dark')
};

const setLight = (setTheme) => {
        console.log("setting light",setTheme)

  localStorage.setItem("theme", "light");
  document.documentElement.setAttribute("data-theme", "light");
  setTheme('light')
};



const Navbar=({currTheme,changeTheme})=>

{
let storedTheme;
storedTheme = localStorage.getItem("theme");
  return (
      <div>
         <div className="h-28 flex flex-row justify-between items-center ">
             <div className="ml-4 w-1/4 flex justify-center" >
                             { (currTheme === 'dark') ? (
                 <div><img className="h-10" src={KartikNameWhite} alt="Kartik"/></div>
            ) : (
                <div><img className="h-10" src={KartikName} alt="Kartik"/></div>
            )}

             </div>
             <div className="grow flex flex-row justify-around text-violet-900 dark:text-violet-100">
                 <div>About</div>
                 <div>Project</div>
                 <div>Resume</div>
                 <div>Contact</div>
             </div>
             <div className="mr-4 w-1/4 flex justify-center ">
                 {storedTheme === 'dark' ? (

                     <div onClick={() => setLight(changeTheme) }>
                         <div><img className="h-8" src={Moon} alt="moon"/></div>
                     </div>
                 ) : (

                     <Sun className="h-8" onClick={() => setDark(changeTheme)}/>

                 )}

             </div>
         </div>

      </div>
  );
}

export default Navbar;