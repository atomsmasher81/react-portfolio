import logo from './logo.svg';
import './App.css';
import Header from "./components/header";
import Navbar from "./components/navbar";
import React from "react";

function App() {
    if (localStorage.theme === 'dark' ){
  document.documentElement.classList.add('dark')
} else {
  document.documentElement.classList.remove('dark')
}

  return (
    <div className="App">
        <Navbar/>
      <header className="App-header">
        <div >
          <div>Hi there !! </div>
          <div>I am Kartik Gautam.</div>
        </div>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          onClick="Counter()"
          rel="noopener noreferrer"
        >
           Towards a better future.
        </a>
      </header>
    </div>
  );
}

export default App; 
