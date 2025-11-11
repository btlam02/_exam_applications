import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RegisterPage from './pages/users/RegisterPage';
import LoginPage from './pages/users/LoginPage';
import HomePage from './pages/home/HomePage';
import Navbar from './components/Navbar';
import AdaptiveTestPage from'./pages/home/AdaptiveTestPage'
import FixedTestPage from './pages/home/FixedTestPage';
import ResultsPage from './pages/home/ResultPage';
import "./App.css"
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


function App() { 
  return (
    <div className=''> 
    <Router>
      <Navbar/>
      <Routes>
        <Route path="/" element={<HomePage/>} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/test/cat" element={<AdaptiveTestPage />} />
        <Route path="/test/fixed" element={<FixedTestPage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </Router>
    </div>
  );
}

export default App;
