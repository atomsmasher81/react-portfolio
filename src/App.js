import './App.css';
import Navbar from "./components/navbar";
import React from "react";
import Home from "./components/Home";
function App() {
    const [Theme, setTheme] =React.useState('light')
    if (localStorage.theme === 'dark' ){
        document.documentElement.classList.add('dark')
    } else {
        document.documentElement.classList.remove('dark')
    }

  return (
    <div className="App h-screen dark:bg-black dark:text-white">
        {/* <Navbar currTheme = {Theme} changeTheme={setTheme}/> */}
        <Home  currTheme = {Theme}/>
    </div> 
  );
}

export default App; 
