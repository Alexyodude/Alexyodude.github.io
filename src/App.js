import logo from './logo.svg';
import './App.css';

import { Routes, Route } from 'react-router-dom';

import Home from './Pages/Home.jsx';
import Navbar  from './Navbar/Navbar.jsx';

import AboutMe from './Pages/About-Me';
import Materials from './Pages/Materials';

function App() {
  return (
    <div className="App">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/About-Me" element={<AboutMe />} />
        <Route path="/Materials" element={<Materials />} />
      </Routes>
    </div>
  );
}

export default App;
