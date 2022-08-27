import React from 'react';
import KartikName from '../assets/kartik.png';
import { ReactComponent as Sun } from '../assets/svgs/sun.svg'

const setDark = () => {
    console.log("setting dark")
  // 2
  localStorage.setItem("theme", "dark");

  // 3
  document.documentElement.setAttribute("data-theme", "dark");
};

const setLight = () => {
        console.log("setting light")

  localStorage.setItem("theme", "light");
  document.documentElement.setAttribute("data-theme", "light");
};



const Navbar=()=>

{
let storedTheme;
storedTheme = localStorage.getItem("theme");

  return (
      <div>
         <div className="h-10 flex flex-row justify-between items-center dark:bg-black">
             <div className="ml-4 w-1/4 flex justify-center" >
                 <div><img className="h-10" src={KartikName} alt="Kartik"/></div>
             </div>
             <div className="grow flex flex-row justify-around">
                 <div>About</div>
                 <div>Project</div>
                 <div>Resume</div>
                 <div>Contact</div>
             </div>
             <div className="mr-4 w-1/4 flex justify-center">
                 {storedTheme === 'dark' ? (

                     <div onClick={() => setLight() }>
                         <img className="h-8" src="https://img.icons8.com/sf-ultralight-filled/50/000000/moon-symbol.png" alt="moon"/>
                     </div>
                 ) : (

                     <Sun className="h-8" onClick={() => setDark()}/>

                 )}

             </div>
         </div>

      </div>
  );
}

export default Navbar;