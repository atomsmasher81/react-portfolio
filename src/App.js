import './App.css';
import Navbar from "./components/navbar";
import React from "react";
import Home from "./components/Home";
function App() {
    if (localStorage.theme === 'dark' ){
  document.documentElement.classList.add('dark')
} else {
  document.documentElement.classList.remove('dark')
}

  return (
    <div className="App h-screen">
        <Navbar/>
        <Home/>
    </div>
  );
}

export default App; 
