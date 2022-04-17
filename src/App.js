import logo from './logo.svg';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          React Portfolio
        </p>
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
